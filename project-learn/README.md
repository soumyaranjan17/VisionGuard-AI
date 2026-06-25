<div align="center">

# 🛡️ VisionGuard-AI

### Client-Side AI Proctoring Engine — Zero Server. Zero Uploads. 100% Edge.

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.x-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Bundle](https://img.shields.io/badge/Bundle-~5.8MB-blueviolet?style=for-the-badge)]()

---

**ProctorAI** is a high-performance, real-time AI proctoring system that runs **entirely in the browser**.  
No video is ever sent to a server. All face tracking, object detection, gaze analysis, and voice recognition  
happen locally on the candidate's machine using WebGL-accelerated neural networks.

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Performance](#-performance)

</div>

---

## 🎯 What This Project Proves

This isn't a tutorial project — it's a **production-grade, multi-threaded edge-AI system** built from scratch.  
It demonstrates mastery of:

| Domain | Skills Demonstrated |
|--------|-------------------|
| **Machine Learning** | YOLOv8 inference, tensor normalization, NMS, class decoding |
| **Computer Vision** | 478-point face mesh, gaze ratio math, bounding box rendering |
| **Concurrency** | Web Workers, `ImageBitmap` zero-copy transfers, `OffscreenCanvas` |
| **React Engineering** | Custom hooks, refs, `useCallback` memoization, state machines |
| **Browser APIs** | `SpeechRecognition`, `visibilitychange`, `getUserMedia`, Canvas2D |
| **Build Optimization** | Tree-shaking, modular TF.js imports, INT8 quantized models |

---

## ✨ Features

### 🔍 Three AI Engines Running Simultaneously

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN THREAD (React UI)                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Webcam   │  │  Canvas      │  │  Dashboard + Alerts   │  │
│  │  720p     │  │  Bounding    │  │  Activity Log         │  │
│  │  Stream   │  │  Boxes       │  │  Gaze Gauge           │  │
│  └────┬─────┘  └──────▲───────┘  └───────────────────────┘  │
│       │               │                                      │
│       │ ImageBitmap    │ postMessage                         │
│       │ (zero-copy)    │ (detections)                        │
│       ▼               │                                      │
│  ┌────────────────────┴──────────────────────────────────┐   │
│  │              WEB WORKER (proctorWorker.js)             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │   │
│  │  │  MediaPipe   │  │  YOLOv8     │  │  YOLOv8      │  │   │
│  │  │  Face Mesh   │  │  Decoder    │  │  INT8 Model  │  │   │
│  │  │  (2.5 MB)    │  │  + NMS      │  │  (Custom)    │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │          Native SpeechRecognition API (0 MB)          │   │
│  │          Auto-restart on silence/errors                │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 🚨 What the System Detects

| Detection | Engine | Action |
|-----------|--------|--------|
| **No Face / Multiple Faces** | MediaPipe Face Mesh | ⚠️ Real-time alert |
| **Looking Away (Left/Right)** | Gaze ratio analysis | ⚠️ Real-time alert + gauge |
| **Cell Phone** | YOLOv8 (custom trained) | 🔴 Red bounding box + alert |
| **Smart Watch** | YOLOv8 | 🔴 Red bounding box + alert |
| **Earbuds** | YOLOv8 | 🔴 Red bounding box + alert |
| **Tablet** | YOLOv8 | 🔴 Red bounding box + alert |
| **Book / Notes** | YOLOv8 | 🔴 Red bounding box + alert |
| **Talking / Whispering** | Native Speech API | ⚠️ Transcript logged |
| **Tab Switch / Window Blur** | DOM Events | 🛑 **Instant termination** |

### 🔒 Security Enforcement

- **Tab switching** → Exam is **immediately terminated**
- **Window focus loss** → Exam is **immediately terminated**
- Camera, AI engines, and speech recognition are all **killed on termination**
- A dark, non-dismissable **"Exam Terminated"** screen with incident report is displayed
- No way to resume — the violation is final

---

## 🏗️ Architecture

```
Proctoring_AI/
├── public/
│   └── web_model/              # Custom YOLOv8 INT8 quantized model
│       ├── model.json          # TF.js graph model manifest
│       ├── group1-shard*.bin   # Weight shards
│       └── metadata.yaml       # Class names + model config
├── src/
│   ├── components/
│   │   ├── ProctoringDashboard.jsx   # Main orchestrator (70/30 grid)
│   │   ├── ProctoringDashboard.css   # Premium dark-mode UI
│   │   ├── WarningPanel.jsx          # Sidebar: metrics + activity log
│   │   ├── WarningPanel.css
│   │   ├── ExamResult.jsx            # Termination screen
│   │   └── StatusIndicator.jsx       # Flag UI atoms
│   ├── hooks/
│   │   ├── useWebcam.js              # Camera lifecycle management
│   │   └── useSpeechRecognition.js   # Voice detection + auto-restart
│   ├── workers/
│   │   └── proctorWorker.js          # Off-thread ML inference engine
│   ├── utils/
│   │   └── constants.js              # Flag configs, thresholds
│   ├── App.jsx
│   └── index.css                     # Global styles + fonts
├── package.json
└── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A browser with **WebGL** support (Chrome recommended)
- A webcam

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Proctoring_AI.git
cd Proctoring_AI

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in Chrome, click **"Start Monitoring"**, and grant camera + microphone permissions.

### Production Build

```bash
npm run build
```

The optimized output lands in `dist/` — ready to deploy to any static host.

---

## 🧠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 19 + Vite 7 | Component architecture + HMR |
| **ML Runtime** | TensorFlow.js 4.x | WebGL-accelerated tensor ops |
| **Face Tracking** | MediaPipe Face Mesh | 478 landmarks, gaze analysis |
| **Object Detection** | YOLOv8 (INT8 quantized) | Device detection at ~5 FPS |
| **Voice** | Native `SpeechRecognition` | Zero-download speech-to-text |
| **Concurrency** | Web Workers + `ImageBitmap` | Non-blocking ML inference |
| **Rendering** | Canvas 2D | Real-time bounding box overlay |
| **Styling** | Vanilla CSS | Glassmorphism dark-mode UI |

---

## ⚡ Performance

| Metric | Value |
|--------|-------|
| **Production Bundle** | ~5.8 MB (gzipped: ~70 KB app + models) |
| **Inference Rate** | ~5 FPS (throttled to save GPU) |
| **Face Mesh Landmarks** | 478 points per face |
| **Model Input Size** | 320 × 320 px |
| **Model Precision** | INT8 quantized |
| **UI Thread Impact** | Near-zero (all ML in Web Worker) |
| **Voice Engine Size** | 0 MB (native browser API) |
| **Backend Required** | ❌ None — fully client-side |

---

## 🏆 Engineering Highlights

### 1. Bootstrapped the React Architecture
- Scaffolded a modern Vite + React application with production-grade tooling
- Offloaded all heavy ML math to a background **Web Worker** (`proctorWorker.js`) so the React UI remains smooth and never freezes during the exam

### 2. Wired Up 3 Distinct AI Engines
- **Custom Object Detection (YOLOv8):** Debugged tensor input (`float32` vs `int32`), corrected the alphabetical class mapping, and fixed canvas rendering math so bounding boxes accurately track devices even when the webcam is mirrored
- **Biometric Tracking (MediaPipe):** Integrated the 2.5 MB Face Mesh model to track 478 facial landmarks — detects if the candidate leaves, looks away, or if multiple faces appear in the frame
- **Voice Recognition:** Activated the browser's zero-MB native `SpeechRecognition` API with custom auto-restart logic to prevent crash-outs from network timeouts

### 3. Built Strict Security Enforcement
- Implemented **Tab & Window Switching Detection** using `visibilitychange` and `blur` DOM events
- On focus loss: instantly halts the exam, shuts down webcam and AI engines to free memory, and traps the user on a custom dark-themed "Exam Terminated" screen with incident report

### 4. Polished the Dashboard UI
- Reorganized the layout into a professional **70/30 CSS Grid split**
- Moved the live **Activity Log** into a sleek, scrollable sidebar styled as a command-center terminal
- Built a detailed **Active Alert HUD** that floats directly over the webcam feed with severity-based glowing borders

### 5. Smashed the File Size Limit
- Replaced monolithic TensorFlow imports with modular `@tensorflow/tfjs-core` + `tfjs-backend-webgl`
- Vite's tree-shaking stripped unused math operations, shrinking the entire application — AI models, React UI, and logic — to an ultra-lean **~5.8 MB** network payload

---

## 📸 Screenshots

> *Start the dev server and navigate to `http://localhost:5173` to see ProctorAI in action.*

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 🧠 Edge AI + ⚛️ React**

</div>
