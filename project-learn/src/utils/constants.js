// ── Proctoring Constants ──────────────────────────────────────────────

// Webcam constraints
export const WEBCAM_CONFIG = {
  width: 1280,
  height: 720,
  facingMode: 'user',
  frameRate: { ideal: 30, max: 30 },
};

// Frame processing interval (ms) — throttle worker inference
export const FRAME_INTERVAL_MS = 200; // ~5 FPS for inference

// ── Face Mesh Keypoints ──────────────────────────────────────────────
export const EYE_LANDMARKS = {
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  LEFT_EYE_PUPIL: 468,
};

// Gaze ratio thresholds
export const GAZE_THRESHOLDS = {
  LOOKING_LEFT: 0.35,
  LOOKING_RIGHT: 0.65,
};

// ── Object Detection Class Map ───────────────────────────────────────
export const CLASS_LABELS = {
  0: 'Person',
  1: 'Cell Phone',
  2: 'Smart Watch',
  3: 'Earbuds',
  4: 'Book',
  5: 'Laptop',
  6: 'Tablet',
  7: 'Notes',
};

// Classes that trigger alerts
export const UNAUTHORIZED_CLASSES = new Set([1, 2, 3, 4, 6, 7]);

// Object detection confidence threshold
export const DETECTION_CONFIDENCE = 0.55;

// ── Flag Types ───────────────────────────────────────────────────────
export const FLAG_TYPES = {
  NO_FACE: 'no_face',
  MULTIPLE_FACES: 'multiple_faces',
  LOOKING_AWAY: 'looking_away',
  TALKING: 'talking',
  PHONE_DETECTED: 'phone_detected',
  WATCH_DETECTED: 'watch_detected',
  EARBUDS_DETECTED: 'earbuds_detected',
  BOOK_DETECTED: 'book_detected',
  TABLET_DETECTED: 'tablet_detected',
  NOTES_DETECTED: 'notes_detected',
};

// Severity levels for UI rendering
export const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Map flag types to severity + display text
export const FLAG_CONFIG = {
  [FLAG_TYPES.NO_FACE]: {
    severity: SEVERITY.CRITICAL,
    label: 'Candidate Left',
    icon: '🚫',
    description: 'No face detected in frame',
  },
  [FLAG_TYPES.MULTIPLE_FACES]: {
    severity: SEVERITY.CRITICAL,
    label: 'Multiple Faces',
    icon: '👥',
    description: 'More than one person detected',
  },
  [FLAG_TYPES.LOOKING_AWAY]: {
    severity: SEVERITY.HIGH,
    label: 'Looking Away',
    icon: '👀',
    description: 'Candidate gaze directed off-screen',
  },
  [FLAG_TYPES.TALKING]: {
    severity: SEVERITY.HIGH,
    label: 'Unauthorized Talking',
    icon: '🗣️',
    description: 'Speech detected via microphone',
  },
  [FLAG_TYPES.PHONE_DETECTED]: {
    severity: SEVERITY.CRITICAL,
    label: 'Cell Phone Detected',
    icon: '📱',
    description: 'Mobile device visible in frame',
  },
  [FLAG_TYPES.WATCH_DETECTED]: {
    severity: SEVERITY.MEDIUM,
    label: 'Smart Watch Detected',
    icon: '⌚',
    description: 'Smart watch visible in frame',
  },
  [FLAG_TYPES.EARBUDS_DETECTED]: {
    severity: SEVERITY.HIGH,
    label: 'Earbuds Detected',
    icon: '🎧',
    description: 'Earbuds / earpiece visible in frame',
  },
  [FLAG_TYPES.BOOK_DETECTED]: {
    severity: SEVERITY.MEDIUM,
    label: 'Book Detected',
    icon: '📖',
    description: 'Book or reference material visible',
  },
  [FLAG_TYPES.TABLET_DETECTED]: {
    severity: SEVERITY.CRITICAL,
    label: 'Tablet Detected',
    icon: '📟',
    description: 'Tablet device visible in frame',
  },
  [FLAG_TYPES.NOTES_DETECTED]: {
    severity: SEVERITY.MEDIUM,
    label: 'Notes Detected',
    icon: '📝',
    description: 'Written notes visible in frame',
  },
};

// Worker message types
export const WORKER_MSG = {
  INIT: 'init',
  PROCESS_FRAME: 'process_frame',
  DETECTION_RESULT: 'detection_result',
  STATUS: 'status',
  ERROR: 'error',
};
