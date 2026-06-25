/* ─────────────────────────────────────────────────────────────────────
   proctorWorker.js — Off-Main-Thread ML Inference Engine
   
   Handles:
   1. MediaPipe Face Mesh (via @tensorflow-models/face-landmarks-detection)
   2. Custom INT8 Object Detection (via tf.loadGraphModel)
   
   Communication protocol:
   IN  → { type: 'init' }                                    — load models
   IN  → { type: 'process_frame', bitmap: ImageBitmap }      — run inference
   OUT → { type: 'detection_result', payload: {...} }         — results
   OUT → { type: 'status', payload: string }                  — status updates
   OUT → { type: 'error', payload: string }                   — errors
   ─────────────────────────────────────────────────────────────────── */

// ── Imports (bundled via Vite worker) ────────────────────────────────
import * as tf from "@tensorflow/tfjs";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";

// ── Constants (duplicated from main thread to avoid import issues) ───
const EYE_LANDMARKS = {
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  LEFT_EYE_PUPIL: 468,
};

const GAZE_THRESHOLDS = {
  LOOKING_LEFT: 0.35,
  LOOKING_RIGHT: 0.65,
};

// MUST match metadata.yaml class order exactly
const CLASS_NAMES = [
  "Cell Phone", // 0
  "Earbuds", // 1
  "Hand", // 2
  "Laptop", // 3
  "Person", // 4
  "Smart Watch", // 5
  "Tablet", // 6
  "book", // 7
];

// Classes that trigger proctoring alerts (by index into CLASS_NAMES)
const UNAUTHORIZED_CLASSES = new Set([0, 1, 5, 6, 7]); // Cell Phone, Earbuds, Smart Watch, Tablet, book

// ── State ────────────────────────────────────────────────────────────
let faceDetector = null;
let objectModel = null;
let isProcessing = false;
let modelsReady = false;

// ── Canvas for frame conversion ──────────────────────────────────────
let offCanvas = null;
let offCtx = null;

// ── Helper: Send message back to main thread ─────────────────────────
function send(type, payload) {
  self.postMessage({ type, payload });
}

// ── Model Initialization ─────────────────────────────────────────────
async function initModels() {
  send("status", "Setting up TensorFlow.js backend...");

  // Prefer WebGL for GPU acceleration, fallback to WASM then CPU
  try {
    await tf.setBackend("webgl");
    await tf.ready();
    send("status", `TF.js backend: ${tf.getBackend()}`);
  } catch (e) {
    console.warn("[Worker] WebGL unavailable, trying wasm:", e);
    try {
      await tf.setBackend("wasm");
      await tf.ready();
      send("status", `TF.js backend: ${tf.getBackend()}`);
    } catch {
      await tf.setBackend("cpu");
      await tf.ready();
      send("status", `TF.js backend: cpu (fallback)`);
    }
  }

  // ── Load Face Mesh ─────────────────────────────────────────────
  send("status", "Loading Face Mesh model...");
  try {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    faceDetector = await faceLandmarksDetection.createDetector(model, {
      runtime: "tfjs",
      refineLandmarks: true,
      maxFaces: 3,
    });
    send("status", "Face Mesh model loaded ✓");
  } catch (err) {
    send("error", `Face Mesh failed to load: ${err.message}`);
  }

  // ── Load Object Detection Model ────────────────────────────────
  send("status", "Loading Object Detection model...");
  try {
    objectModel = await tf.loadGraphModel("/web_model/model.json");
    send("status", "Object Detection model loaded ✓");
  } catch (err) {
    // Non-fatal: model files might not be present yet
    send("status", `Object Detection model not available: ${err.message}`);
    objectModel = null;
  }

  modelsReady = true;
  send("status", "All models initialized — ready for inference");
}

// ── Gaze Ratio Calculation ───────────────────────────────────────────
function calculateGazeRatio(keypoints) {
  const outer = keypoints[EYE_LANDMARKS.LEFT_EYE_OUTER];
  const inner = keypoints[EYE_LANDMARKS.LEFT_EYE_INNER];
  const pupil = keypoints[EYE_LANDMARKS.LEFT_EYE_PUPIL];

  if (!outer || !inner || !pupil) return 0.5; // neutral fallback

  const eyeWidth = Math.abs(inner.x - outer.x);
  if (eyeWidth < 1) return 0.5;

  const pupilOffset = Math.abs(pupil.x - outer.x);
  return pupilOffset / eyeWidth;
}

// ── Face Detection & Gaze Analysis ───────────────────────────────────
async function analyzeFaces(imageData) {
  if (!faceDetector) {
    return { faceCount: -1, gazeRatio: 0.5, flags: [] };
  }

  const flags = [];

  try {
    const faces = await faceDetector.estimateFaces(imageData, {
      flipHorizontal: false,
    });

    const faceCount = faces.length;

    if (faceCount === 0) {
      flags.push({ type: "no_face", message: "No face detected" });
    } else if (faceCount > 1) {
      flags.push({
        type: "multiple_faces",
        message: `${faceCount} faces detected`,
      });
    }

    let gazeRatio = 0.5;

    if (faceCount === 1) {
      const keypoints = faces[0].keypoints;
      gazeRatio = calculateGazeRatio(keypoints);

      if (gazeRatio < GAZE_THRESHOLDS.LOOKING_LEFT) {
        flags.push({
          type: "looking_away",
          message: "Looking left",
          gazeRatio,
        });
      } else if (gazeRatio > GAZE_THRESHOLDS.LOOKING_RIGHT) {
        flags.push({
          type: "looking_away",
          message: "Looking right",
          gazeRatio,
        });
      }
    }

    return { faceCount, gazeRatio, flags };
  } catch (err) {
    console.error("[Worker] Face detection error:", err);
    return { faceCount: -1, gazeRatio: 0.5, flags: [] };
  }
}

// ── YOLOv8 Output Decoder with NMS ───────────────────────────────────
const processYOLOOutput = async (predictions) => {
  // YOLOv8 outputs [1, 12, 2100]. We squeeze and transpose it to [2100, 12]
  // to loop through the 2100 anchor points.
  const transposed = predictions.squeeze().transpose();
  const rawData = await transposed.array();

  const boxes = [];
  const scores = [];
  const classIndices = [];

  // 1. Loop through all 2100 predictions
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    // The first 4 numbers are the box coordinates (x_center, y_center, width, height)
    // The next 8 numbers are the confidence scores for each of your 8 classes
    const classScores = row.slice(4, 12);
    const maxScore = Math.max(...classScores);
    const classIndex = classScores.indexOf(maxScore);

    // 2. Filter out weak guesses (Only keep confident detections > 60%)
    if (maxScore > 0.6) {
      const [xCenter, yCenter, width, height] = row.slice(0, 4);

      // Convert center coordinates to top-left coordinates for the HTML Canvas
      const xMin = xCenter - width / 2;
      const yMin = yCenter - height / 2;

      boxes.push([yMin, xMin, yMin + height, xMin + width]); // TF.js NMS expects [yMin, xMin, yMax, xMax]
      scores.push(maxScore);
      classIndices.push(classIndex);
    }
  }

  // 3. Run Non-Maximum Suppression (NMS) to remove duplicate overlapping boxes
  if (boxes.length > 0) {
    const nmsResults = await tf.image.nonMaxSuppressionAsync(
      tf.tensor2d(boxes),
      tf.tensor1d(scores),
      10, // Max number of boxes to keep
      0.4, // IOU threshold (how much overlap is allowed)
      0.5, // Score threshold
    );

    const validIndices = await nmsResults.array();

    // 4. Format the final clean data
    const finalDetections = validIndices.map((index) => ({
      class: CLASS_NAMES[classIndices[index]],
      score: scores[index].toFixed(2),
      box: boxes[index], // [yMin, xMin, yMax, xMax]
    }));

    // 5. Send the clean data back to the React UI!
    self.postMessage({ type: "DETECTIONS", payload: finalDetections });

    tf.dispose(nmsResults);
  } else {
    // Tell React nothing was found so it can clear the canvas
    self.postMessage({ type: "DETECTIONS", payload: [] });
  }

  tf.dispose(transposed);
};

// ── Object Detection (runs YOLOv8 inference + decoding) ──────────────
async function detectObjects(imageData) {
  if (!objectModel) {
    return { detections: [], flags: [] };
  }

  const flags = [];

  try {
    // Convert image to tensor
    const inputTensor = tf.browser
      .fromPixels(imageData)
      .resizeBilinear([320, 320])
      .cast("float32")
      .div(tf.scalar(255))
      .expandDims(0);

    // Run inference
    const predictions = await objectModel.executeAsync(inputTensor);

    // Decode YOLOv8 output and send DETECTIONS to React for canvas drawing
    await processYOLOOutput(predictions);

    // Also build flags for the WarningPanel from the decoded detections
    // Re-decode quickly for flag generation
    const transposed = predictions.squeeze().transpose();
    const rawData = await transposed.array();

    const detections = [];
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const classScores = row.slice(4, 12);
      const maxScore = Math.max(...classScores);
      const classIndex = classScores.indexOf(maxScore);

      if (maxScore > 0.6) {
        const label = CLASS_NAMES[classIndex] || `Class ${classIndex}`;
        detections.push({ classId: classIndex, label, confidence: maxScore });

        if (UNAUTHORIZED_CLASSES.has(classIndex)) {
          const flagTypeMap = {
            0: "phone_detected",
            1: "earbuds_detected",
            5: "watch_detected",
            6: "tablet_detected",
            7: "book_detected",
          };
          flags.push({
            type: flagTypeMap[classIndex] || "unknown_object",
            message: `${label} detected (${Math.round(maxScore * 100)}%)`,
          });
        }
      }
    }

    tf.dispose([transposed, inputTensor]);
    if (Array.isArray(predictions)) {
      predictions.forEach((t) => t.dispose());
    } else {
      predictions.dispose();
    }

    return { detections, flags };
  } catch (err) {
    console.error("[Worker] Object detection error:", err);
    return { detections: [], flags: [] };
  }
}

// ── Process a single video frame ─────────────────────────────────────
async function processFrame(bitmap) {
  if (!modelsReady || isProcessing) return;
  isProcessing = true;

  try {
    // Draw bitmap to OffscreenCanvas for tensor conversion
    if (!offCanvas) {
      offCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      offCtx = offCanvas.getContext("2d");
    }

    // Resize canvas if needed
    if (
      offCanvas.width !== bitmap.width ||
      offCanvas.height !== bitmap.height
    ) {
      offCanvas.width = bitmap.width;
      offCanvas.height = bitmap.height;
    }

    offCtx.drawImage(bitmap, 0, 0);

    // Run both detections concurrently
    const [faceResult, objectResult] = await Promise.all([
      analyzeFaces(offCanvas),
      detectObjects(offCanvas),
    ]);

    // Merge flags
    const allFlags = [...faceResult.flags, ...objectResult.flags];

    send("detection_result", {
      timestamp: Date.now(),
      faces: {
        count: faceResult.faceCount,
        gazeRatio: faceResult.gazeRatio,
      },
      objects: objectResult.detections,
      flags: allFlags,
    });
  } catch (err) {
    send("error", `Frame processing failed: ${err.message}`);
  } finally {
    // Always close the bitmap to free memory
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
    isProcessing = false;
  }
}

// ── Message Handler ──────────────────────────────────────────────────
self.onmessage = async (event) => {
  const { type, bitmap } = event.data;

  switch (type) {
    case "init":
      await initModels();
      break;

    case "process_frame":
      if (bitmap) {
        await processFrame(bitmap);
      }
      break;

    default:
      console.warn("[Worker] Unknown message type:", type);
  }
};
