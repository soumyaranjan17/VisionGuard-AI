import { useState, useEffect, useRef, useCallback } from "react";
import { useWebcam } from "../hooks/useWebcam";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import WarningPanel from "./WarningPanel";
import ExamResult from "./ExamResult";
import {
  FRAME_INTERVAL_MS,
  FLAG_TYPES,
  FLAG_CONFIG,
  WORKER_MSG,
} from "../utils/constants";
import "./ProctoringDashboard.css";

/**
 * Main proctoring dashboard component.
 * Orchestrates webcam, speech recognition, and Web Worker inference.
 */
export default function ProctoringDashboard() {
  // ── Webcam ──────────────────────────────────────────
  const {
    videoRef,
    isActive: webcamActive,
    error: webcamError,
    startWebcam,
    stopWebcam,
  } = useWebcam();

  // ── Speech Recognition ──────────────────────────────
  const { isTalking, transcript, isSupported, startListening, stopListening } =
    useSpeechRecognition();

  // ── Worker State ────────────────────────────────────
  const workerRef = useRef(null);
  const canvasRef = useRef(null);
  const frameLoopRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  const [workerStatus, setWorkerStatus] = useState("Initializing...");
  const [activeFlags, setActiveFlags] = useState(new Set());
  const [gazeRatio, setGazeRatio] = useState(0.5);
  const [faceCount, setFaceCount] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [flagLog, setFlagLog] = useState([]);

  // ── Exam Termination State ─────────────────────────
  const [isExamTerminated, setIsExamTerminated] = useState(false);
  const isTerminatedRef = useRef(false); // ref to avoid stale closures

  // ── Draw Bounding Boxes on Canvas ───────────────────
  const drawBoundingBoxes = useCallback((detections) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Clear the previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Calculate the scale difference between the AI (320px) and your UI
    const scaleX = canvas.width / 320;
    const scaleY = canvas.height / 320;

    detections.forEach((detection) => {
      // YOLO outputs [yMin, xMin, yMax, xMax]
      const [y1, x1, y2, x2] = detection.box;

      // 2. Scale the box up to match your video size
      let xMin = x1 * scaleX;
      let yMin = y1 * scaleY;
      let width = (x2 - x1) * scaleX;
      let height = (y2 - y1) * scaleY;

      // 3. Flip the X coordinate (Because webcams act like mirrors)
      xMin = canvas.width - xMin - width;

      // Draw the box
      ctx.strokeStyle = detection.class === "Person" ? "#00FF00" : "#FF0000";
      ctx.lineWidth = 3;
      ctx.strokeRect(xMin, yMin, width, height);

      // Draw the label
      ctx.fillStyle = detection.class === "Person" ? "#00FF00" : "#FF0000";
      ctx.font = "bold 16px Arial";

      // Add a slight background to the text so it's easier to read
      ctx.fillText(`${detection.class} (${detection.score})`, xMin, yMin - 8);
    });
  }, []);

  // ── Initialize Worker ───────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/proctorWorker.js", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      // Handle DETECTIONS from YOLOv8 decoder (bounding boxes for canvas)
      if (type === "DETECTIONS") {
        drawBoundingBoxes(payload);
        // Also check proctoring rules
        const forbiddenItems = payload.filter(
          (d) =>
            d.class === "Cell Phone" ||
            d.class === "Smart Watch" ||
            d.class === "Earbuds" ||
            d.class === "book" ||
            d.class === "Tablet",
        );
        if (forbiddenItems.length > 0) {
          setActiveFlags((prev) => {
            const next = new Set(prev);
            forbiddenItems.forEach((item) => {
              next.add(
                `${item.class.toLowerCase().replace(/\s/g, "_")}_detected`,
              );
            });
            return next;
          });
        }
        return;
      }

      switch (type) {
        case WORKER_MSG.STATUS:
          setWorkerStatus(payload);
          break;

        case WORKER_MSG.DETECTION_RESULT:
          handleDetectionResult(payload);
          break;

        case WORKER_MSG.ERROR:
          console.error("[Worker Error]", payload);
          setWorkerStatus(`Error: ${payload}`);
          break;

        default:
          break;
      }
    };

    worker.onerror = (err) => {
      console.error("[Worker Fatal]", err);
      setWorkerStatus("Worker crashed");
    };

    // Send init command
    worker.postMessage({ type: WORKER_MSG.INIT });
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Detection Results from Worker ────────────
  const handleDetectionResult = useCallback((payload) => {
    const { faces, flags } = payload;

    setFaceCount(faces.count);
    setGazeRatio(faces.gazeRatio);

    // Build new active flags set from worker results
    const newFlags = new Set();
    flags.forEach((f) => newFlags.add(f.type));

    setActiveFlags((prev) => {
      // Merge with speech flag (handled in main thread)
      const merged = new Set(newFlags);
      if (prev.has(FLAG_TYPES.TALKING)) {
        merged.add(FLAG_TYPES.TALKING);
      }
      return merged;
    });

    // Log new flags
    if (flags.length > 0) {
      setFlagLog((prev) => {
        const newEntries = flags.map((f) => ({
          ...f,
          timestamp: Date.now(),
        }));
        return [...newEntries, ...prev].slice(0, 50); // Keep last 50
      });
    }
  }, []);

  // ── Speech flag sync ────────────────────────────────
  useEffect(() => {
    setActiveFlags((prev) => {
      const next = new Set(prev);
      if (isTalking) {
        next.add(FLAG_TYPES.TALKING);
      } else {
        next.delete(FLAG_TYPES.TALKING);
      }
      return next;
    });

    if (isTalking) {
      setFlagLog((prev) =>
        [
          {
            type: FLAG_TYPES.TALKING,
            message: `Speech: "${transcript}"`,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 50),
      );
    }
  }, [isTalking, transcript]);

  // ── Frame Capture Loop ─────────────────────────────
  const captureFrame = useCallback(() => {
    if (!workerRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // not ready

    const now = performance.now();
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL_MS) return;
    lastFrameTimeRef.current = now;

    // Create ImageBitmap from the video element (transferable)
    createImageBitmap(video)
      .then((bitmap) => {
        workerRef.current?.postMessage(
          { type: WORKER_MSG.PROCESS_FRAME, bitmap },
          [bitmap], // Transfer ownership
        );
      })
      .catch(() => {
        // Silently handle — frame drops are acceptable
      });
  }, [videoRef]);

  const frameLoop = useCallback(
    function animateFrame() {
      captureFrame();
      frameLoopRef.current = requestAnimationFrame(animateFrame);
    },
    [captureFrame],
  );

  // ── Start / Stop Proctoring ─────────────────────────
  const handleStart = useCallback(async () => {
    await startWebcam();
    startListening();
    setIsRunning(true);

    // Sync canvas size with video after webcam starts
    requestAnimationFrame(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }
    });
  }, [startWebcam, startListening, videoRef]);

  const handleStop = useCallback(() => {
    if (frameLoopRef.current) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }
    stopWebcam();
    stopListening();
    setIsRunning(false);
    setIsPaused(false);
  }, [stopWebcam, stopListening]);

  const handleClearAlerts = useCallback(() => {
    setActiveFlags(new Set());
    setFlagLog([]);
    setWorkerStatus("Ready");
  }, []);

  const handleResetDashboard = useCallback(() => {
    handleStop();
    setActiveFlags(new Set());
    setFlagLog([]);
    setFaceCount(-1);
    setGazeRatio(0.5);
    setWorkerStatus("Ready");
    setIsPaused(false);
    setIsExamTerminated(false);
    isTerminatedRef.current = false;
  }, [handleStop]);

  const handlePauseResume = useCallback(() => {
    if (!isRunning) return;

    if (isPaused) {
      setIsPaused(false);
      setWorkerStatus("Monitoring resumed");
      frameLoopRef.current = requestAnimationFrame(frameLoop);
    } else {
      setIsPaused(true);
      setWorkerStatus("Monitoring paused");
      if (frameLoopRef.current) {
        cancelAnimationFrame(frameLoopRef.current);
        frameLoopRef.current = null;
      }
    }
  }, [frameLoop, isPaused, isRunning]);

  // Start frame loop when webcam becomes active
  useEffect(() => {
    if (webcamActive && isRunning) {
      frameLoopRef.current = requestAnimationFrame(frameLoop);
    }
    return () => {
      if (frameLoopRef.current) {
        cancelAnimationFrame(frameLoopRef.current);
      }
    };
  }, [webcamActive, isRunning, frameLoop]);

  // ── Terminate Exam (instant shutdown) ────────────
  const terminateExam = useCallback(() => {
    if (isTerminatedRef.current) return; // prevent double-fire
    isTerminatedRef.current = true;
    console.warn("[Proctor] ⛔ Tab/Window switch detected — terminating exam!");

    // 1. Set terminated state
    setIsExamTerminated(true);
    setIsRunning(false);

    // 2. Cancel the frame loop
    if (frameLoopRef.current) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }

    // 3. Stop webcam tracks
    stopWebcam();

    // 4. Terminate the Web Worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    // 5. Stop speech recognition
    stopListening();
  }, [stopWebcam, stopListening]);

  // ── Tab / Window Switch Detection ────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && !isTerminatedRef.current) {
        terminateExam();
      }
    };

    const handleWindowBlur = () => {
      if (!isTerminatedRef.current) {
        terminateExam();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [terminateExam]);

  // ── Render ──────────────────────────────────────────
  // If exam is terminated, show the result screen
  if (isExamTerminated) {
    return (
      <ExamResult
        violation="Window Focus Lost"
        onBackHome={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="proctoring-dashboard">
      {/* ── Background Grid ────────────────────── */}
      <div className="bg-grid" />

      {/* ── Top Bar ────────────────────────────── */}
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="logo">
            <span className="logo-icon">◆</span>
            <span className="logo-text">ProctorAI</span>
          </div>
          <span className="version-tag">v1.0 · Edge</span>
        </div>
        <div className="top-bar-center">
          <div className={`live-indicator ${isRunning ? "live" : ""}`}>
            <span className="live-dot" />
            <span>{isRunning ? "MONITORING" : "STANDBY"}</span>
          </div>
        </div>
        <div className="top-bar-right">
          <span className="privacy-badge">🔒 100% Local Processing</span>
        </div>
      </header>

      {/* ── Main Content ───────────────────────── */}
      <main className="dashboard-main">
        {/* Left: Video Feed */}
        <section className="video-section">
          <div
            className={`video-container ${activeFlags.size > 0 ? "has-alerts" : ""}`}
          >
            {/* Corner markers */}
            <div className="corner-mark top-left" />
            <div className="corner-mark top-right" />
            <div className="corner-mark bottom-left" />
            <div className="corner-mark bottom-right" />

            <video ref={videoRef} className="video-feed" playsInline muted />

            {/* Canvas overlay for bounding boxes — positioned exactly over video */}
            <canvas ref={canvasRef} className="detection-canvas" />

            {!webcamActive && (
              <div className="video-placeholder">
                <div className="placeholder-content">
                  <div className="placeholder-icon">📷</div>
                  <p>Camera feed will appear here</p>
                  <p className="placeholder-sub">
                    Click "Start Monitoring" to begin
                  </p>
                </div>
              </div>
            )}

            {/* Overlay badges on video */}
            {isRunning && (
              <div className="video-overlay">
                <div className="overlay-top">
                  <span className="rec-badge">
                    <span className="rec-dot" />
                    REC
                  </span>
                  <span className="res-badge">720p</span>
                </div>
                {activeFlags.size > 0 && (
                  <div className="overlay-alert">
                    ⚠️ {activeFlags.size} violation
                    {activeFlags.size > 1 ? "s" : ""} detected
                  </div>
                )}
              </div>
            )}

            {/* ── Active Alert Overlay (floats over video) ── */}
            {isRunning &&
              activeFlags.size > 0 &&
              (() => {
                // Pick the most important active flag to display
                const severityOrder = ["critical", "high", "medium", "low"];
                let topFlag = null;
                for (const sev of severityOrder) {
                  for (const [flagType, config] of Object.entries(
                    FLAG_CONFIG,
                  )) {
                    if (activeFlags.has(flagType) && config.severity === sev) {
                      topFlag = { type: flagType, ...config };
                      break;
                    }
                  }
                  if (topFlag) break;
                }
                if (!topFlag) return null;

                return (
                  <div
                    className={`active-alert-overlay severity-glow-${topFlag.severity}`}
                  >
                    <div className="alert-overlay-icon">{topFlag.icon}</div>
                    <div className="alert-overlay-body">
                      <div className="alert-overlay-title">{topFlag.label}</div>
                      <div className="alert-overlay-desc">
                        {topFlag.description}
                      </div>
                      <div className="alert-overlay-time">
                        {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                    {activeFlags.size > 1 && (
                      <div className="alert-overlay-badge">
                        +{activeFlags.size - 1} more
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Controls */}
          <div className="controls">
            {!isRunning ? (
              <button className="btn btn-start" onClick={handleStart}>
                <span className="btn-icon">▶</span>
                Start Monitoring
              </button>
            ) : (
              <button className="btn btn-stop" onClick={handleStop}>
                <span className="btn-icon">■</span>
                Stop Monitoring
              </button>
            )}

            {isRunning && (
              <button className="btn btn-secondary" onClick={handlePauseResume}>
                <span className="btn-icon">{isPaused ? "▶" : "⏸"}</span>
                {isPaused ? "Resume" : "Pause"}
              </button>
            )}

            <button className="btn btn-secondary" onClick={handleClearAlerts}>
              <span className="btn-icon">🧹</span>
              Clear Alerts
            </button>

            {!isRunning && (
              <button
                className="btn btn-secondary"
                onClick={handleResetDashboard}
              >
                <span className="btn-icon">🔄</span>
                Reset Dashboard
              </button>
            )}

            {webcamError && (
              <div className="error-banner">
                <span>⚠️ Camera Error: {webcamError}</span>
              </div>
            )}

            {!isSupported && (
              <div className="warning-banner">
                <span>ℹ️ Speech Recognition not supported in this browser</span>
              </div>
            )}
          </div>
        </section>

        {/* Right: Warning Panel */}
        <aside className="panel-section">
          <WarningPanel
            activeFlags={activeFlags}
            workerStatus={workerStatus}
            gazeRatio={gazeRatio}
            faceCount={faceCount}
            flagLog={flagLog}
          />
        </aside>
      </main>
    </div>
  );
}
