# FormFit – A Smarter, Calmer Fitness Experience

[![Deploy to GitHub Pages](https://github.com/MDhanushraju/gym/actions/workflows/deploy.yml/badge.svg)](https://github.com/MDhanushraju/gym/actions/workflows/deploy.yml)
**Live Demo:** [https://MDhanushraju.github.io/gym/](https://MDhanushraju.github.io/gym/)

**FormFit** is a peaceful, natural, and premium fitness companion designed to transform exercise from an intimidating chore into a calm, mindful movement habit. It combines **computer vision movement analysis (MediaPipe)** with **Apple Fitness and Scandinavian wellness aesthetics**, offering real-time postural guidance with zero cloud latency and 100% on-device privacy.

---

## 🌿 Design Philosophy & Visual System

- **Aesthetic:** Apple Fitness meets Scandinavian minimalism—light, spacious, comfortable, and organic.
- **Palette:**
  - **Backgrounds:** Warm off-white (`#F8FAF8`), Soft ivory (`#F5F7F2`), Pure white cards (`#FFFFFF`).
  - **Accents:** Sage green (`#8DAF9A`), Soft mint (`#DCEDE3`), Mint light (`#F0F7F3`).
  - **Secondary:** Pale blue (`#E5F0F5`), Soft lavender (`#EDE9F5`), Warm beige (`#F1EBDD`).
  - **Typography:** Dark forest green (`#263D32`), Charcoal (`#343B37`), Muted grey (`#78847D`).
  - **Status:** Accessible green (`#2E7D32`), Warm amber (`#D97706`), Soft red (`#D32F2F`).
- **Interactions:** Subtle floating waves, gentle card lift on hover, smooth page transitions, and full support for `prefers-reduced-motion`.

---

## 📱 Platform Features & Screens

### 1. Welcome Experience
- **Heading:** *"Move Better. Feel Better. Every Day."*
- **Supporting text:** *"Your personal movement companion. Understand your form, improve your technique and build healthier movement habits."*
- Organic wave background, daily intention widget, and 3-step breakdown (*01 Choose Your Movement*, *02 Let FormFit Observe*, *03 Improve With Guidance*).

### 2. Exercise Exploration ("Find Your Movement")
- Interactive cards for **Weighted Squats**, **Upright Dumbbell Row**, **Forward Dumbbell Row**, and **Single-Hand Dumbbell Row**.
- Real-time search by name, muscle, or description.
- Filters by difficulty (*Beginner*, *Intermediate*, *Advanced*), muscle groups (*Legs*, *Back*, *Shoulders*), favorites (heart toggle), and recently practiced movements.

### 3. Exercise Learning ("Learn the Movement")
- Professional reference video with slow-motion (`0.5x`, `0.75x`, `1.0x`), frame scrubbing, and pose overlay.
- **Interactive Anatomical Joint Guide:** Highlights tracked joints (Hips, Knees, Ankles, Shoulders) and their biomechanical target angles.
- Guidance tabs for starting position, posture, hand placement, movement flow, breathwork cadence, and safety guidance.
- Practice checklist with interactive checkboxes.

### 4. Universal Camera & Live Coach Experience
- Universal camera support (laptops, desktops, USB webcams, iPhone, Android, and tablets).
- Friendly 5-step camera setup guide and device switcher (`navigator.mediaDevices.enumerateDevices`).
- Real-time MediaPipe 33-point pose detection rendered in accessible green/amber/red indicators.
- **Personal AI Voice Coach:** Friendly, supportive speech feedback via Web Speech API (`speechSynthesis`) with customizable pace and frequency.
- Live repetition counter, movement phase detection (*Controlled Descent*, *Peak Contraction*, *Ascending Drive*), and real-time movement checklist.

### 5. Workout Summary ("Well Done! You Showed Up Today.")
- Celebratory completion view with gentle confetti animation.
- Total repetitions, session duration, movement quality score, balanced checkpoints, and coach's thoughts.
- Automatically records sessions into local storage.

### 6. Personal Fitness Dashboard ("My Movement")
- Aggregate telemetry: total sessions, total repetitions, average movement quality, and movements mastered.
- **Daily Movement Goals:** Interactive target reps and minutes with a circular progress ring.
- **Weekly Activity Rhythm:** 7-day consistency tracker.
- **Personal Progress Tracker:** Improvement trends over time supported by actual stored session data, frequent observation patterns, and workout history table with a clear history option.

### 7. Video Upload & Side-by-Side Comparison
- Supports MP4, WebM, and MOV video file uploads.
- **1-Click Demo Workout Clips** for instant offline testing.
- Side-by-side synchronized video players with speed control and pose skeleton overlays.
- Movement comparison matrix, expandable diagnostic mistake cards, and printable coaching reports.

---

## 🔬 Biomechanical Push-Up Engine & Replay Test Harness

FormFit features a deterministic, pure-function biomechanical engine (`PurePushupEngine`) decoupled from the DOM and React. It runs in both the live camera UI and the automated offline replay harness.

### 1. Data Diagnosis & Root Causes Solved

| Old Flawed Approach | Root Failure Mechanism | PurePushupEngine Fix |
|---|---|---|
| **Frame-Height Normalization** (`deltaShoulderY / frameHeight`) | At 2m distance, a full push-up descent of 20px is only ~0.018 frame height. Minor camera tilt yielded 0.016, causing the engine to reject real pushups as *"Wrist/arm movement only without body descent"* (12 rejections in user tests). | **Body-Scale Normalization ($L_{torso}$):** All vertical displacements are normalized by Euclidean torso length ($L_{torso} = \text{shoulder-to-hip distance}$), yielding 0.75x–1.1x descent invariant to user distance or camera zoom. |
| **Rigid 2D Elbow Target** (`(160 - angle) / 70`) | Profile vs head-on quarter angles foreshorten arm bones, reporting ~149° when the user is chest-to-floor, yielding the false *"motion range 13%"* error. | **Combined Normalized Descent Metric:** Integrates body-scale shoulder descent (60%) and elbow flexion (40%): $D_{comb} = 0.6 \cdot D_{shoulder} + 0.4 \cdot \text{Flexion}$. |
| **Averaging Left & Right Joints** | When facing 45° to camera, the occluded arm produces noisy or flipped 0-visibility coordinates, skewing angles by 30°–60°. | **Single Dominant Side:** Evaluates mean visibility across shoulder, elbow, wrist, and hip. Selects exclusively the cleaner kinetic chain with hysteresis lock. |
| **Coupled Form Scoring & Rep Counting** | Repetition would not count if user had slightly sagging hips or imperfect lockout. | **Decoupled Architecture:** Rep validity determines *if* the pushup occurred. Form evaluation independently scores technique (e.g. 75% for sagging hips) and emits voice coaching. |
| **2D Horizontal Plank Gate** | Required screen $\Delta x > 0.22$. Head-on or 3/4 depth views have small screen $\Delta x \approx 0.04$ with $\Delta z \approx 1.12$, failing the gate. | **3D Horizontal Span Gate:** $\sqrt{\Delta x^2 + \Delta z^2} \ge 0.25$, supporting side-profile, head-on, angled cameras, and knee push-ups. |

---

### 2. Running Automated Replay & Validation Benchmark Suites

FormFit includes 4 comprehensive automated test suites (31 passing tests) covering real user recordings, synthetic kinematics, edge cases, and cheats:

```bash
# 1. Offline Replay Test Suite (4/4 Benchmarks Passed)
# Tests pushup_5reps.json (5 reps), negative_random.json (0 reps),
# pushup_incomplete.json (2 reps), and user_recorded_pushup.json (real recording)
node test/replay/replaySuite.test.js

# 2. Per-Frame Signal Telemetry & Matplotlib Signal Plotter
# Generates ASCII signal chart and saves pushup_5reps_signal_plot.png
python test/replay/plot_signals.py

# 3. Canonical Push-Up Detection Suite (Tests A through G - 7/7 Passed)
# Tests normal pushup, hip sag, arm twitching, hip pump, incomplete, rapid & slow reps
node test/pushupDetectionSuite.test.js

# 4. Formanti Multi-Exercise & Calibration Suite (12/12 Passed)
# Tests face-only rejection, hand-only, standing rejection, dropout recovery, etc.
node test/formantiValidation.test.js

# 5. AI Exercise Video Analysis Suite (8/8 Passed)
# Tests exercise classification, squat/pushup mismatch protection, 5-category scoring
node test/videoAnalysisSuite.test.js
```

---

### 3. Live UI Diagnostic HUD & Session JSON Export

- **"Export Session JSON" Button:** Prominently available in the live coach header and debug panel. Allows recording live camera sessions into a timestamped JSON file containing 33 MediaPipe landmarks and joint angles, ready for offline replay analysis.
- **Live Analysis Debug Mode (HUD):** Real-time monitoring overlay showing camera FPS, processing FPS, dominant side visibility, smoothed elbow angle, shoulder descent ratio, hip alignment, state machine transitions, and rejection reasons.

---

## 🛠️ Technology Stack

- **React 18** (Vite build system)
- **Tailwind CSS** (Custom calm color tokens, soft shadows, wave animations)
- **MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`) (On-device WebAssembly pose detection)
- **Web Speech API** (Natural voice coaching)
- **HTML5 Video & Canvas 2D API** (Synchronized dual-playback and procedural video rendering)
- **Local Storage API** (Zero-backend private persistence for history, daily goals, and preferences)

---

## 🏃 Getting Started

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

Build for production:

```bash
npm run build
```
