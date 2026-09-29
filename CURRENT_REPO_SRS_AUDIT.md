# Comprehensive Repository Audit & SRS Alignment Review: Révéla

**Document:** `CURRENT_REPO_SRS_AUDIT.md`  
**Repository:** `Revela` (Senior Design Project)  
**Audit Date:** September 2026  
**Audit Mode:** Read-Only Source Code, Configuration, Documentation, and Git History Audit  

---

## 1. Current Product Overview

### What Révéla Is Now
Révéla is an on-device, privacy-first mobile application (iOS & Android) designed to evaluate cosmetic facial skin appearance. It guides the user through a structured multi-angle facial scan (Front, Left ¾, and Right ¾ angles), performs multi-label computer vision classification on the captured images, aggregates the per-angle observations into a unified session summary, and is designed to feed that summary and local history into an on-device Large Language Model (LLM) to deliver personalized, non-diagnostic cosmetic feedback and routine guidance.

### Primary Platform
* **Primary Target:** Native Mobile (**iOS** and **Android**).
  * **iOS:** Currently has the most advanced integration via an in-tree native Expo Module (`RevelaVisionModule.swift`) executing an Apple Core ML model (`skin_model.mlmodel`).
  * **Android:** Architecturally targeted in configurations (`mobile/app.json`) and specifications (`docs/model-integration.md`), with planned TensorFlow Lite (TFLite) inference (Android native bridge not yet written).
* **Development / Prototyping Platforms:**
  * **Expo / React Native:** Cross-platform mobile development environment (`mobile/package.json`).
  * **Web (Expo Web & HTML Prototype):** Used for rapid UI review and visual workflows (`prototype/revela-updated-prototype.html`, `mobile/package.json`).
  * **Desktop Workstation (macOS / Windows / Linux):** Python training, validation, Core ML / TorchScript exporting, and webcam capture simulation (`vision/`).

### Main Purpose
To provide users with private, continuous, longitudinal tracking of visible cosmetic skin conditions (acne, dark circles, dryness, oiliness, hyperpigmentation) and tailored routine recommendations—without ever transmitting sensitive facial images, biometrics, or health data off the user's mobile device.

### Technology Stack
* **Mobile Frontend & Framework:**
  * React Native `0.86.3`
  * Expo SDK `~57.0.21` (`expo-camera` `~57.0.4`, `expo-router` `~57.0.20`, `expo-modules-core` `~57.0.17`)
  * TypeScript `~6.0.3`
* **On-Device Vision & Inference Engine:**
  * iOS Runtime: Apple Core ML (`MLModel`, `CVPixelBuffer`, Vision framework integration) inside custom Expo module `RevelaVisionModule.swift`.
  * Python Pipeline: PyTorch (`torch`, `torchvision`), `coremltools`, OpenCV (`opencv-python`), Pillow (`PIL`).
  * Model Architecture: Deep convolutional network based on MobileNetV2 with a custom 5-output multi-label classification head.
* **On-Device LLM (Planned / In Scaffolding):**
  * Targeted Runtimes: `llama.cpp` or `MLC-LLM` mobile bindings running quantized 1B–4B parameter models locally on device.
  * System Prompt: Descriptive, non-diagnostic cosmetic advice prompt defined in `llm/prompts/system_prompt.md`.
* **Backend & Authentication (Network Boundary):**
  * Supabase Auth: Experimental signup connection (`mobile/src/supabaseclient.ts`, `mobile/src/signup.tsx`). Strictly restricted to account creation/updates; prohibited from receiving telemetry, images, or session history.
* **Rapid Prototyping:**
  * Standalone HTML5/CSS3/JavaScript mock application (`prototype/revela-updated-prototype.html`).

---

## 2. Current User Flow

The current user flow consists of seven functional stages, spanning implemented code, mock implementations, and planned components:

```
[ Welcome / Onboarding ]  --->  [ Auth / Login (Demo) ]
             |
             v
   [ 3-Angle Camera Capture ]   (Front -> Left 3/4 -> Right 3/4)
             |
             v
 [ Vision Inference & Aggregation ]  (Core ML on iOS; TFLite planned)
             |
             v
  [ Results & Session Summary ]  (Conditions, Confidence, Severity)
             |
             +---> [ Recommendations & Routine ] (Morning / Evening routines)
             |
             +---> [ History & Progress Tracking ] (Longitudinal scans)
             |
             +---> [ Profile & Local Preferences ]
```

| Flow Stage | Current Implementation State | Status | Evidence File Paths | Notes & Gaps |
|---|---|---|---|---|
| **Onboarding** | Welcome screen with brand title, tagline, description, and "Get Started" button routing to `/login`. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/index.tsx`<br>`mobile/app/index.tsx` | Branded with legacy name "SKUBBA" and smart mirror copy ("Review smart-mirror scans..."). |
| **Login / Auth** | Demo login screen with prefilled demo credentials (`demo@skubba.app` / `demo1234`), mock validation delay, and routing to `/(tabs)/home`. Separate experimental Supabase signup screen exists. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/login.tsx`<br>`mobile/skubba-mobile-app/services/auth.ts`<br>`mobile/src/signup.tsx`<br>`mobile/src/supabaseclient.ts` | Supabase auth is partially written in `mobile/src/signup.tsx` but is orphaned (not linked in navigation); `login.tsx` currently bypasses real authentication with a mock timer. |
| **Camera / Capture** | Guided 3-angle capture screen (Front, Left ¾, Right ¾) using `expo-camera`. Step progress counter, angle titles, positioning prompts, and camera preview with manual button capture. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/capture.tsx`<br>`mobile/app/capture.tsx`<br>`docs/model-integration.md` (Lines 24–36) | Current mobile capture requires manual button taps. Automated face pose detection (yaw/pitch), face size validation (>=120px), brightness range (35–230), and Laplacian sharpness check (>=25) are prototyped in Python (`vision/webcam-test.py`) but **not yet integrated** into the mobile camera view. |
| **Analysis / Inference** | Captured frames are passed as URIs to `runVisionInference()`. On iOS, `NativeVision.predict()` executes `skin_model.mlmodel` via `RevelaVisionModule.swift`. Per-angle predictions are aggregated using `Math.max` per condition across the three views. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/services/vision.ts`<br>`mobile/modules/revela-vision/ios/RevelaVisionModule.swift`<br>`mobile/src/screens/CaptureSummaryScreen.tsx` | **iOS only.** Requires a physical Mac and iOS runtime. Android TFLite runner is not implemented. Web runtime cannot run the native module. |
| **Results** | Displays capture angles, detected conditions, presence indicators, confidence percentages, severity badges, and region descriptions. | **IMPLEMENTED** (Functional for iOS scan output; mock-supported for historical views) | `mobile/src/screens/CaptureSummaryScreen.tsx`<br>`mobile/app/summary.tsx`<br>`mobile/skubba-mobile-app/app/scan/[id].tsx`<br>`prototype/revela-updated-prototype.html` | Real-time results displayed on `CaptureSummaryScreen.tsx`. Historical scan detail view (`scan/[id].tsx`) currently reads from static mock data (`mockScans.ts`). |
| **Recommendations** | Routine screen displaying structured Morning Routine, Evening Routine, curated product category cards, and non-medical cosmetic disclaimer. | **PARTIALLY IMPLEMENTED** (Mock data UI) | `mobile/skubba-mobile-app/app/(tabs)/routine.tsx`<br>`mobile/skubba-mobile-app/data/mockProducts.ts`<br>`mobile/skubba-mobile-app/components/ProductCard.tsx` | Static UI rendering mock routine steps and mock products. On-device LLM dynamic generation is not yet connected. |
| **History** | Scan History tab rendering a chronological list of prior scans with timestamps, primary condition chips, and confidence percentages. Navigates to scan detail screen. | **PARTIALLY IMPLEMENTED** (Mock data UI) | `mobile/skubba-mobile-app/app/(tabs)/history.tsx`<br>`mobile/skubba-mobile-app/components/ScanCard.tsx`<br>`mobile/skubba-mobile-app/data/mockScans.ts` | Displays 3 mock scans (`scan-001`, `scan-002`, `scan-003`). Local persistent database (SQLite / AsyncStorage) is not yet wired to save real scan summaries. |
| **Settings / Profile** | Profile tab showing user name, email, an informational Data & Privacy card, and a Sign Out button. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/(tabs)/profile.tsx` | No functional configuration settings (e.g. skin focus selection, tone preference, data export, cache purging, or model updates). |

---

## 3. Current Architecture

### Folder Structure Overview & File Evidence

```
Revela/
├── docs/                      # Technical specifications and architectural constraints
├── llm/                       # Prompt templates and on-device model artifacts
├── mobile/                    # React Native / Expo application workspace
│   ├── app/                   # Expo Router routes (re-exports / entry routes)
│   ├── modules/revela-vision/ # Native iOS Core ML bridge module
│   ├── skubba-mobile-app/     # Inherited prototype screens, mock data, and components
│   └── src/                   # Session types, summary screen, and Supabase client
├── prototype/                 # Standalone HTML/CSS/JS prototype
├── vision/                    # PyTorch training, Core ML export, and validation scripts
├── COPILOT_INSTRUCTIONS.md    # Master architectural brief and boundary rules
└── README.md                  # Developer quickstart instructions
```

### Purpose of Important Folders

#### `mobile/`
* **Purpose:** The core cross-platform client application built with React Native and Expo (SDK 57). Houses the user interface, navigation, native module bridges, and local client state.
* **Exact Evidence File Paths:**
  * `mobile/package.json`: Configures dependencies (`expo`, `react-native`, `expo-camera`, `expo-router`, `revela-vision`).
  * `mobile/app.json`: Expo configuration, camera permissions string (`"Allow Révéla to use your camera for local skin captures."`), and app identity.
  * `mobile/App.tsx` & `mobile/index.ts`: Application bootstrap rendering `CaptureSummaryScreen`.
  * `mobile/app/_layout.tsx`, `mobile/app/index.tsx`, `mobile/app/capture.tsx`, `mobile/app/summary.tsx`: Expo Router top-level entry paths re-exporting modules.
  * `mobile/modules/revela-vision/ios/RevelaVisionModule.swift`: In-tree native iOS Swift module performing Core ML inference on local image files.
  * `mobile/modules/revela-vision/ios/skin_model.mlmodel`: The compiled Core ML neural network package embedded into the iOS bundle.
  * `mobile/modules/revela-vision/src/index.ts`: TypeScript declaration and wrapper for `requireNativeModule('RevelaVision')`.
  * `mobile/skubba-mobile-app/`: Sub-package containing UI views (`app/`), mock data (`data/mockScans.ts`), and services (`services/vision.ts`, `services/api.ts`, `services/auth.ts`).
  * `mobile/src/screens/CaptureSummaryScreen.tsx`: Active UI screen orchestrating vision inference and rendering results.
  * `mobile/src/types/session.ts`: Canonical TypeScript data contracts for `ConditionName`, `SessionSummary`, and `UserProfile`.
  * `mobile/src/supabaseclient.ts` & `mobile/src/signup.tsx`: Experimental Supabase account creation client and screen.

#### `vision/`
* **Purpose:** The machine learning pipeline for training, evaluating, and exporting the cosmetic skin classifier.
* **Exact Evidence File Paths:**
  * `vision/main.py`: PyTorch training script training a multi-label MobileNetV2 with `nn.BCEWithLogitsLoss` using class-imbalance weighting over datasets (`scin-filter/cosmetic_dataset_split/`).
  * `vision/model_utils.py`: Contains `build_model()` (MobileNetV2 classifier head modification), `image_transform()`, `load_checkpoint()`, and `aggregate_angle_predictions()`.
  * `vision/skin_model_weights.pth`: Serialized PyTorch state dictionary containing trained weights for the 5 target classes.
  * `vision/export_model.py`: Generates intermediate TorchScript artifacts (`skin_model.torchscript.pt`) and JSON normalization metadata.
  * `vision/convert_coreml.py`: Converts PyTorch weights into Apple Core ML format (`skin_model.mlmodel`) using `coremltools`.
  * `vision/webcam-test.py`: Desktop OpenCV validation harness testing 3-angle sequential capture, Haar cascade face detection, Laplacian sharpness gating, and prediction aggregation.
  * `vision/requirements.txt`: Python dependencies (`torch`, `torchvision`, `pillow`, `opencv-python`).

#### `etl/`
* **Purpose:** **DOES NOT EXIST IN THE CURRENT REPOSITORY.**
* **Status / Finding:** There is no folder named `etl`, nor are there any ETL scripts or references in source code or Git history.
* **Explanation:** While dataset extraction and transformation were performed externally (e.g. preparing `scin-filter/cosmetic_dataset_split/` from the Google SCIN dataset referenced in `vision/main.py`), the ETL code itself was not committed to this repository.

#### `llm/`
* **Purpose:** Prompt engineering templates, few-shot examples, and local quantized LLM artifacts.
* **Exact Evidence File Paths:**
  * `llm/prompts/system_prompt.md`: Defines the system instructions constraining the LLM to descriptive, non-diagnostic, encouraging cosmetic language.
  * `COPILOT_INSTRUCTIONS.md` (Lines 35–37, 62–67): Outlines planned integration with `llama.cpp` or `MLC-LLM` and a quantized model artifact directory (`llm/quantized_models/`).
* **Current State:** Only the system prompt file exists. Model weights, quantization scripts, and runtime mobile bindings are not yet implemented.

#### `prototype/`
* **Purpose:** Rapid web-based prototyping and interactive UI/UX demonstration of the target mobile experience.
* **Exact Evidence File Paths:**
  * `prototype/revela-updated-prototype.html`: Standalone single-page interactive mock featuring Home screen metrics, animated 3-step Face Scan simulation with alignment guides, Scan Results with condition breakdown and cheek heatmaps, and a historical progress timeline.

#### `docs/`
* **Purpose:** System architecture documentation, model integration specifications, and boundary contracts.
* **Exact Evidence File Paths:**
  * `docs/architecture.md`: Defines product flow, offline core loop constraints, and folder layout.
  * `docs/model-integration.md`: Defines the exact MobileNetV2 input/output contract, tensor normalization, category mapping rules, and capture gating thresholds.

---

## 4. Vision / AI

### Current Model Architecture
* **Backbone:** **MobileNetV2** (`torchvision.models.mobilenet_v2` with `MobileNet_V2_Weights.IMAGENET1K_V1`).
* **Evidence:** `vision/model_utils.py` (Lines 19–23):
  ```python
  def build_model(num_classes, pretrained=False):
      weights = models.MobileNet_V2_Weights.IMAGENET1K_V1 if pretrained else None
      model = models.mobilenet_v2(weights=weights)
      model.classifier[1] = nn.Linear(model.last_channel, num_classes)
      return model
  ```
* **Is MobileNetV2 Still Used?** **YES.** It is the active architecture for both training (`vision/main.py`), export (`vision/convert_coreml.py`), and on-device iOS execution (`skin_model.mlmodel`).

### Classification Head & Output Activation
* **Head Type:** Multi-label classification (not single-label / softmax).
* **Loss Function:** `nn.BCEWithLogitsLoss(pos_weight=pos_weight)` (`vision/main.py` Line 86).
* **Activation:** Independent **Sigmoid** applied to each logit.
* **Decision Threshold:** `0.5` presence threshold across all classes.

### Supported Skin Conditions
The trained model artifact (`vision/skin_model_weights.pth`) and model metadata (`docs/model-integration.md`) explicitly support **5 conditions**:

1. **`Acne`** (mapped in UI to `'acne'`)
2. **`Dark_Circles`** (mapped in UI to `'dark_circles'`)
3. **`Dry_Skin`** (mapped in UI to `'dryness'`)
4. **`Oily_Skin`** (mapped in UI to `'oily_skin'`)
5. **`Post-Inflammatory_hyperpigmentation`** (mapped in UI to `'hyperpigmentation'`)

> [!WARNING]
> **Status of `Redness`:**  
> `Redness` is **NOT** supported by the trained computer vision model.  
> As explicitly stated in `docs/model-integration.md` (Lines 41–46):  
> *"The model's categories do not exactly match the current UI schema... redness is not an output of this model and must not be inferred from another class."*  
> Any references to redness in earlier UI mocks (`mockData.ts`, `revela-updated-prototype.html`) are legacy placeholders.

### Where Inference Happens
* **Location:** **100% On-Device.**
* **iOS Implementation:** Executed natively via Apple Core ML (`MLModel`) in `mobile/modules/revela-vision/ios/RevelaVisionModule.swift`. The model file `skin_model.mlmodel` is bundled directly into the application.
* **Android Implementation:** Planned for on-device execution via TensorFlow Lite (TFLite); native wrapper not yet created.
* **Desktop / Testing:** Executed locally via PyTorch CPU/CUDA in `vision/webcam-test.py`.
* **Zero Cloud Inference:** No image frames or tensors are ever uploaded to a remote server.

### Inputs and Outputs Contract
* **Input Tensor:**
  * Dimensions: `1 x 3 x 224 x 224` (`NCHW` layout).
  * Color Space: RGB.
  * Normalization: ImageNet standard (Mean: `[0.485, 0.456, 0.406]`, StdDev: `[0.229, 0.224, 0.225]`).
* **Output Tensor:**
  * Shape: `1 x 5` vector of floating-point probabilities between `0.0` and `1.0`.
* **Aggregation Method:**
  * `aggregate_angle_predictions()` takes the maximum confidence across all 3 accepted angles (Front, Left ¾, Right ¾) for each class:
    $$\text{Confidence}_c = \max(\text{Conf}_{c,\text{front}}, \text{Conf}_{c,\text{left\_3q}}, \text{Conf}_{c,\text{right\_3q}})$$
  * Evidence: `vision/model_utils.py` (Lines 54–61) and `mobile/skubba-mobile-app/services/vision.ts` (Lines 30–32).

---

## 5. Large Language Model (LLM)

### Implementation Status
* **Status:** **NOT IMPLEMENTED (Planned / System Prompt Only).**
* **Evidence:**
  * The file `llm/prompts/system_prompt.md` exists and contains system instructions.
  * No model binaries (e.g. `.gguf`, `.bin`), runtime libraries, or wrapper code exist in `llm/` or `mobile/`.
  * The mobile summary screen (`mobile/src/screens/CaptureSummaryScreen.tsx` Lines 122–126) renders a static card with mock preferences rather than invoking an LLM.

### Model and Runtime Architecture
* **Target Runtime:** `llama.cpp` or `MLC-LLM` mobile bindings (`COPILOT_INSTRUCTIONS.md` Line 20).
* **Target Model Parameter Size:** Quantized small models targeting **1B to 4B parameters** (up to 7B–8B only on high-end hardware).
* **System Prompt Contract:**
  * Location: `llm/prompts/system_prompt.md`
  * Text:
    > *"You are an on-device beauty assistant for cosmetic skin feedback. Provide short, descriptive, non-diagnostic language about skin appearance. Focus on tone, texture, hydration, brightness, clarity, and treatment fit. Avoid medical diagnosis or treatment claims. Keep the answer encouraging and practical."*

### Is Ollama Still Used?
* **Answer:** **NO.**
* **Evidence:** There are zero references to Ollama across all code, documentation, and Git history. Ollama is a desktop/server daemon and is incompatible with the project's strict on-device mobile architectural constraints.

### Local vs. Remote
* **Architecture Rule:** **Strictly LOCAL (On-Device).**
* **Evidence:** `COPILOT_INSTRUCTIONS.md` (Lines 18–20, 110) strictly forbids remote LLM API calls (such as OpenAI, Anthropic, or remote hosted endpoints) inside the core capture-analysis loop.

---

## 6. Data & Privacy

### Stored Data
* **Current Storage (Prototype):** Static in-memory mock data (`mobile/skubba-mobile-app/data/mockScans.ts`, `mobile/src/data/mockData.ts`).
* **Designed Data Schema:**
  1. `SessionSummary`: Session UUID, ISO8601 timestamp, captured angles list, and condition results (presence boolean, confidence float, facial region, severity level).
  2. `UserProfile`: User UUID, baseline per-condition score averages, and user preferences (focus areas, tone).
  * Evidence: `mobile/src/types/session.ts` and `COPILOT_INSTRUCTIONS.md` (Lines 80–101).

### Where Data Is Stored
* **Planned Persistence:** Strictly **Local On-Device Storage** using SQLite / Room / Core Data / AsyncStorage.
* **Evidence:** `COPILOT_INSTRUCTIONS.md` (Lines 13, 18, 69) and `docs/architecture.md` (Line 22).

### Do Images or User Data Leave the Device?
* **Answer:** **NO.**
* **Policy & Constraints:**
  * Sensitive facial images are held temporarily in local cache memory for inference and are not uploaded to any remote server or cloud database.
  * `COPILOT_INSTRUCTIONS.md` (Lines 18–19): *"Fully offline core loop. Camera capture → vision inference → aggregation → LLM generation → local storage must work with zero network calls. No sensitive data leaves the device. No image, embedding, or condition-history upload, ever, in the core loop."*

### Privacy Mechanisms: Implementation Audit

| Privacy Mechanism | Status | Repository Evidence & Analysis |
|---|---|---|
| **Camera Permissions** | **IMPLEMENTED** | Configured in `mobile/app.json` (Lines 14–19) with user disclosure: `"Allow Révéla to use your camera for local skin captures."` Checked and requested at runtime in `mobile/skubba-mobile-app/app/capture.tsx` using `expo-camera`'s `useCameraPermissions()`. |
| **User Consent Flow** | **NOT IMPLEMENTED** | Only static informational text exists on the Profile screen (`mobile/skubba-mobile-app/app/(tabs)/profile.tsx` Lines 17–19). No interactive consent acceptance or terms opt-in screen exists. |
| **Data Deletion** | **NOT IMPLEMENTED** | No deletion controls, account deletion endpoints, or local cache clearing functions exist in code. `mockScans.ts` mentions an `imageExpiresAt` timestamp field, but no deletion worker is implemented. |
| **Local Encryption** | **NOT IMPLEMENTED** | No SQLCipher, secure keystore integration, or encrypted file storage is currently implemented in `mobile/`. |
| **Account Boundary Isolation** | **PARTIALLY IMPLEMENTED (Architectural rule only)** | `mobile/src/supabaseclient.ts` initializes Supabase Auth, but no session history or image upload APIs exist. Strict structural isolation between auth and health data is planned (`COPILOT_INSTRUCTIONS.md` Line 77). |

---

## 7. Packaging & Deployment

### Production Targets vs. Development Platforms

```
+-------------------------------------------------------------------------+
|                          DEVELOPMENT PLATFORMS                          |
|  - Windows / macOS / Linux Workstations                                 |
|  - Python 3.10+ (PyTorch, OpenCV, CoreMLTools)                          |
|  - Node.js / Expo CLI (Metro Bundler, Expo Go, Expo Web)                |
|  - Static Browser Preview (prototype/revela-updated-prototype.html)     |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                        OFFICIAL PRODUCTION TARGETS                       |
|                                                                         |
|  [ iOS ] (Active Development)        [ Android ] (Planned Target)       |
|  - Target: iOS 14.0+ / 16.0+         - Target: Modern Android (API 26+) |
|  - Engine: Apple Core ML             - Engine: TFLite (Planned)         |
|  - Module: RevelaVisionModule.swift  - Module: Native bridge unwritten  |
|  - Packaging: IPA via EAS / Xcode    - Packaging: APK/AAB via EAS       |
+-------------------------------------------------------------------------+
```

* **Current Official Production Target:**
  * **Native Mobile: iOS and Android.**
  * Configured in `mobile/app.json` (bundle configuration for iOS tablets, Android adaptive icons, Expo camera plugins).
* **Hardware Requirements for Building:**
  * **macOS Workstation Required:** As noted in Git commit `0292d46` (*"model integrated (doesn't work unless you have a mac lolz)"*) and `vision/convert_coreml.py` (Line 73), building the iOS native module and compiling `.mlmodel` packages requires Xcode and macOS tooling.
* **Platforms Explicitly NOT in Production Scope:**
  * **Raspberry Pi:** Excluded. No ARM Linux packages or Pi dependencies exist.
  * **Smart Mirror Hardware:** Excluded. Replaced by personal smartphone hardware.
  * **Web Browsers (Production):** The production vision module relies on native CVPixelBuffer/CoreML bindings unavailable in standard web browsers.
  * **Cloud Backend / Docker Containers:** Excluded. No backend microservices or container manifests exist.

---

## 8. Outdated or Removed Features

Audit of legacy concepts inherited from earlier design documents or predecessor projects (notably the "SKUBBA" smart mirror project):

| Legacy Concept / Term | Found in Current Repo Files? | Status | Detailed Explanation & Repository Evidence |
|---|---|---|---|
| **Raspberry Pi** | **NO** (0 occurrences in code or Git history) | **REMOVED / LEGACY** | If the original SRS specified a Raspberry Pi single-board computer to drive a smart mirror display or camera, it has been completely eliminated. The app is 100% targeted at iOS and Android mobile devices. |
| **Smart Mirror** | **YES** (Found in 7 files in `mobile/skubba-mobile-app/`) | **LEGACY (Transitional copy)** | The predecessor project was named "SKUBBA" and functioned as a companion app to a physical smart mirror (`mobile/skubba-mobile-app/README.md` Line 76: *"Add user-to-mirror pairing (QR code or one-time code)"*; `app/index.tsx` Line 13: *"Review smart-mirror scans..."*). In the current Révéla architecture, the smart mirror is **completely deprecated**; the user's phone camera performs the capture. |
| **Webcam / Continuous Scanning** | **YES** (`vision/webcam-test.py` Lines 34–48) | **LEGACY / DESKTOP TEST UTILITY ONLY** | `vision/webcam-test.py` opens a PC webcam (`cv2.VideoCapture(0)`) and runs continuous frame loops. This was used solely as a developer desk test for Haar cascade face tracking and Laplacian sharpness checks. The production mobile app does **not** use webcams or continuous background scanning; it performs discrete 3-angle capture via `expo-camera`. |
| **Docker** | **NO** (Only transitive lockfile entries in `is-docker`) | **REMOVED / LEGACY** | There are no Dockerfiles, `docker-compose.yml`, or container images in the repository. All inference and storage are on-device; no containerized cloud backend is required. |
| **Ollama** | **NO** (0 occurrences in code or Git history) | **REMOVED / LEGACY** | Ollama is neither present nor planned. The architecture specifies embedded mobile runtimes (`llama.cpp` or `MLC-LLM` C++ bindings) compiled directly into the mobile application package. |
| **Cloud Database** | **PARTIALLY PRESENT AS STUB** (`mobile/skubba-mobile-app/services/api.ts`, `mobile/src/supabaseclient.ts`) | **CHANGED / STRICTLY RESTRICTED** | Earlier plans envisioned a FastAPI or Supabase cloud database storing scan history. Under the current Révéla architecture, a cloud database for scans, images, or health data is **strictly prohibited**. Only authentication/account creation is permitted to touch a cloud service (`COPILOT_INSTRUCTIONS.md` Lines 18–19). |
| **Single-Label MobileNetV2 (Softmax)** | **YES** (Referenced in `COPILOT_INSTRUCTIONS.md` Line 45, replaced in `vision/main.py`) | **REMOVED / UPGRADED** | The original vision model was a single-label softmax classifier. It has been replaced by a multi-label sigmoid classifier trained with `nn.BCEWithLogitsLoss`. |

---

## 9. Recent Major Changes (Git History Analysis)

The Git history consists of 8 key commits detailing the evolution from initial concept to the current implementation:

```
d97ff78  (2026-09-15)  Add updated frontend prototype (revela-updated-prototype.html)
   |
d9414a6  (2026-09-11)  Merge remote changes with Supabase setup
   | \
   |  37b09f1 (2026-09-11) Supabase signup connection - test (signup.tsx, supabaseclient.ts)
0292d46  (2026-09-08)  model integrated (doesn't work unless you have a mac lolz)
   |                   [Added CoreML module, PyTorch training, weights, webcam-test]
6d84b63  (2026-09-08)  mobile app works with react-native & expo [Expo router integration]
   |
c245f43  (2026-09-08)  Added the app [Imported SKUBBA mobile prototype pack]
   |
e6f8475  (2026-09-01)  Scaffolding [Initial React Native app, docs/architecture.md, mockData]
   |
7581703  (2026-09-01)  Initial Commit [COPILOT_INSTRUCTIONS.md architectural brief]
```

### Key Architectural Shifts Identified from Commit History
1. **Transition from Single-Label to Multi-Label On-Device Vision (Commit `0292d46`):**
   * Replaced single-label softmax assumption with a multi-label BCE loss MobileNetV2 in `vision/main.py`.
   * Trained a 5-class model artifact (`vision/skin_model_weights.pth`) and added Core ML export pipeline (`vision/convert_coreml.py`).
   * Integrated the model directly into an Expo iOS native module (`mobile/modules/revela-vision/ios/RevelaVisionModule.swift`).
2. **Transition from Smart Mirror ("SKUBBA") to Mobile Camera Capture (Commit `c245f43` & `0292d46`):**
   * Imported legacy SKUBBA mobile UI pack (`c245f43`).
   * Added direct device camera capture screen (`mobile/skubba-mobile-app/app/capture.tsx`) using `expo-camera`, bypassing physical smart mirror scanning (`0292d46`).
3. **Attempted Cloud Auth Integration & Merge Divergence (Commits `37b09f1` & `d9414a6`):**
   * Commit `37b09f1` introduced `@supabase/supabase-js`, `mobile/src/supabaseclient.ts`, and `mobile/src/signup.tsx`.
   * Merge commit `d9414a6` merged this code into `main`, but resolved package dependencies such that `@supabase/supabase-js` was left out of `mobile/package.json`, leaving `signup.tsx` unlinked and non-functional in the main app flow.
4. **Refined UI/UX Visual Specification (Commit `d97ff78`):**
   * Added `prototype/revela-updated-prototype.html` providing a visual prototype for 3-angle guidance, face landmark grids, and cheek condition heatmaps.

---

## 10. SRS Update Table

This table maps standard Software Requirements Specification (SRS) sections against the current repository state.

**Status Legend:**
* **CURRENT:** Active, accurately reflected in current code and matches design.
* **CHANGED:** Concept has evolved significantly from the legacy specification.
* **REMOVED:** Feature or technology is completely eliminated from the architecture.
* **PARTIALLY IMPLEMENTED:** Code exists, but features are incomplete, mock-backed, or platform-limited.
* **PLANNED:** Documented in architectural specifications, but no code is yet written.
* **UNKNOWN:** Cannot be determined from repository contents.

| SRS Area | Current Implementation State | Status | Evidence File Paths | Recommended Change for Updated SRS |
|---|---|---|---|---|
| **Product Concept** | Personal mobile cosmetic skincare assistant app with on-device AI analysis and 3-angle camera capture. | **CHANGED** | `COPILOT_INSTRUCTIONS.md`<br>`docs/architecture.md`<br>`mobile/app.json` | Replace all references to a physical "smart mirror" or "mirror companion app" with a standalone, mobile-first iOS/Android application. |
| **Purpose and Use** | Informational, cosmetic tracking of skin appearance over time (acne, dark circles, dryness, oiliness, hyperpigmentation). Non-medical, non-diagnostic. | **CURRENT** | `llm/prompts/system_prompt.md`<br>`mobile/skubba-mobile-app/app/(tabs)/routine.tsx`<br>`mobile/skubba-mobile-app/app/scan/[id].tsx` | Reaffirm strictly cosmetic, non-diagnostic use cases; mandate explicit non-medical disclaimers on all scan and routine screens. |
| **Intended Audience** | General consumers seeking personal skincare tracking. Demographic breakdowns, skin type groups, or age constraints are not specified in code. | **UNKNOWN** | `prototype/revela-updated-prototype.html`<br>`COPILOT_INSTRUCTIONS.md` (Line 47) | State that the audience is general consumer skincare users. Add explicit SRS requirements for validation across Fitzpatrick skin phototypes I–VI. |
| **Features & Functions: Capture** | Guided sequential capture of Front, Left ¾, and Right ¾ face views via phone camera. Currently requires manual shutter taps. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/capture.tsx`<br>`vision/webcam-test.py` | Update SRS to require a native capture coordinator with automatic pose estimation, face centering (width >=120px), brightness checks (35–230), and blur/sharpness gating (Laplacian >=25) for 12 stable frames. |
| **Features & Functions: Vision** | Multi-label on-device MobileNetV2 classifying 5 conditions. Aggregation via per-condition maximum confidence across angles. | **PARTIALLY IMPLEMENTED** (iOS only) | `vision/model_utils.py`<br>`vision/skin_model_weights.pth`<br>`mobile/modules/revela-vision/ios/` | Update SRS vision specification to MobileNetV2 with 5 sigmoid outputs (`Acne`, `Dark_Circles`, `Dry_Skin`, `Oily_Skin`, `Hyperpigmentation`). Remove `Redness` from current model deliverables. Specify Android TFLite parity. |
| **Features & Functions: LLM** | Non-diagnostic natural language feedback and routine generation. System prompt defined; runtime unwritten. | **PLANNED** | `llm/prompts/system_prompt.md`<br>`COPILOT_INSTRUCTIONS.md` (Lines 62–67) | Specify an embedded on-device runtime (`llama.cpp` / `MLC-LLM`) with 1B–4B quantized models. Eliminate any cloud LLM API requirements. |
| **Features & Functions: Routines** | Displays morning/evening routines and curated product cards. Currently static mock data. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/(tabs)/routine.tsx`<br>`mobile/skubba-mobile-app/data/mockProducts.ts` | Transition requirement from static mock routine lists to dynamically generated routines driven by scan summary outputs and user preferences. |
| **Features & Functions: History** | Chronological list of past scans with score/confidence and details. Currently reads mock data array. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/(tabs)/history.tsx`<br>`mobile/skubba-mobile-app/data/mockScans.ts` | Specify an on-device local database (SQLite/Room/Core Data) storing `SessionSummary` records locally without cloud sync. |
| **Features & Functions: Settings** | Profile view with demo info and sign out button. No settings controls. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/(tabs)/profile.tsx` | Add functional requirements for user preferences (tone selection, skin focus toggles), local cache clearing, data export, and baseline reset. |
| **Inputs** | Three RGB face camera images (Front, Left ¾, Right ¾) resized to `224 x 224`. | **CURRENT** | `docs/model-integration.md`<br>`mobile/skubba-mobile-app/app/capture.tsx` | Formalize input requirements: 3 RGB images at 224x224 pixels, ImageNet normalized, captured under verified lighting and sharpness conditions. |
| **Outputs** | Multi-label probabilities for 5 conditions, aggregated session summary, confidence %, region mapping, and cosmetic feedback text. | **CURRENT** | `mobile/src/types/session.ts`<br>`docs/model-integration.md` | Align output schema in SRS to match `SessionSummary` (`acne`, `dark_circles`, `dryness`, `oily_skin`, `hyperpigmentation`). Explicitly remove `redness`. |
| **Product Interfaces** | Mobile GUI built with React Native / Expo Router. Native Swift Core ML bridge for iOS. | **PARTIALLY IMPLEMENTED** | `mobile/app/`<br>`mobile/modules/revela-vision/` | Replace any smart-mirror touch screen or web dashboard specifications with iOS and Android native/Expo mobile interface specifications. |
| **Customer Requirements: Privacy** | Zero image, biometric, or health data upload. Strictly local processing. Cloud limited strictly to account creation/updates. | **CHANGED** | `COPILOT_INSTRUCTIONS.md` (Lines 18–19)<br>`docs/architecture.md` | Upgrade privacy requirements: make the offline core loop a mandatory non-functional requirement. Prohibit cloud transmission of biometric or scan data. |
| **Packaging & Hardware** | Mobile app package (iOS IPA, Android APK/AAB). Personal smartphone with front camera. | **CHANGED** | `mobile/app.json`<br>`mobile/package.json` | Strike all Raspberry Pi hardware, custom mirror casing, external webcam peripherals, and two-way glass specifications. Replace with standard iOS/Android hardware requirements. |
| **Performance** | Capture quality gating: >=120px face width, 35–230 brightness, >=25 Laplacian sharpness across 12 frames. Model input: 224x224. Latency numbers not benchmarked. | **PARTIALLY IMPLEMENTED** | `docs/model-integration.md`<br>`vision/webcam-test.py` | Add explicit real-time latency thresholds for mobile vision inference (<500ms on device) and LLM token streaming. Retain documented capture quality thresholds. |
| **Safety & Security** | Informational cosmetic disclaimer; local sandboxing. Local database encryption and consent toggles unwritten. | **PARTIALLY IMPLEMENTED** | `mobile/skubba-mobile-app/app/scan/[id].tsx`<br>`llm/prompts/system_prompt.md` | Formalize non-diagnostic disclaimers to prevent medical liability. Specify requirements for local data-at-rest encryption (e.g. SQLCipher) and user consent gates. |
| **Maintenance & Updates** | Model and app updates delivered over network. Code architecture unwritten. | **PLANNED** | `COPILOT_INSTRUCTIONS.md` (Lines 74–77) | Define update delivery architecture for on-device Core ML / TFLite models and LLM weights that strictly prevents accessing local user history. |
| **Other Requirements: Cloud Services** | Supabase Auth prototype for account creation; currently unlinked. FastAPI backend mentioned in comments but absent. | **PARTIALLY IMPLEMENTED** | `mobile/src/supabaseclient.ts`<br>`mobile/skubba-mobile-app/services/api.ts` | Clarify cloud role: Cloud is strictly an optional identity service (Supabase Auth). Remove references to FastAPI backend unless designated for model distribution. |
| **Future Items** | Android TFLite integration, on-device LLM (llama.cpp/MLC), automated capture coordinator, SQLite local database, Fitzpatrick evaluation. | **PLANNED** | `COPILOT_INSTRUCTIONS.md`<br>`vision/README.md`<br>`docs/model-integration.md` | Group these items into future development phases in the updated SRS roadmap. |

---

## 11. Executive Summary & Critical SRS Recommendations

### What Révéla Is Now
Révéla has pivoted from a hardware-based "smart mirror" companion system into a **fully standalone, privacy-centric mobile application for iOS and Android**. Built with React Native (Expo SDK 57) and on-device machine learning (MobileNetV2 via Apple Core ML on iOS), Révéla guides users through a private 3-angle facial capture, runs multi-label computer vision locally to evaluate 5 cosmetic skin conditions (`Acne`, `Dark Circles`, `Dry Skin`, `Oily Skin`, `Hyperpigmentation`), and aggregates the results into an actionable cosmetic routine—guaranteeing that facial photos and skin metrics never leave the user's smartphone.

### What the Old SRS Would Likely Get Wrong
An outdated SRS for this project would likely contain critical misconceptions that contradict the current codebase:
1. **Hardware Platform:** The old SRS likely specifies a **Raspberry Pi**, external webcam, two-way mirror glass, and display housing. *Reality:* All custom hardware has been removed; Révéla is an iOS/Android mobile app using the smartphone camera.
2. **Cloud vs. Local Architecture:** The old SRS likely describes a cloud-hosted backend (Docker, FastAPI, cloud databases, remote model servers) that processes user photos. *Reality:* The core loop is strictly offline and on-device. Images and scan history are prohibited from touching the network.
3. **Vision Model & Output Contract:** The old SRS likely assumes single-label classification or includes `Redness`. *Reality:* The vision model is a multi-label MobileNetV2 outputting 5 specific conditions via independent sigmoids; `Redness` is **not** supported by the trained model.
4. **LLM Execution:** The old SRS may assume Ollama or a cloud API (OpenAI/Anthropic). *Reality:* Ollama is completely absent; the design mandates an embedded, quantized on-device runtime (`llama.cpp` or `MLC-LLM`).
5. **App Identity & Scope:** The old SRS may refer to the project as "SKUBBA" and treat the mobile app as a remote viewer for mirror scans. *Reality:* The project is "Révéla", and the mobile app is the self-contained capture and analysis device.

---

### The 10 Highest-Priority SRS Updates

1. **Pivot Hardware Specification from Smart Mirror / Raspberry Pi to Native Mobile:**  
   Remove all references to Raspberry Pi single-board computers, monitors, webcams, and mirror enclosures. Specify iOS (iOS 14+/16+) and Android (API 26+) mobile devices running Expo / React Native.
2. **Mandate the Strict Offline Privacy Boundary (Zero Cloud Biometrics):**  
   Codify the architectural invariant: camera capture, vision inference, result aggregation, LLM feedback, and history storage must operate 100% offline with zero network calls. No images, embeddings, or condition history may ever leave the device.
3. **Update Vision Model Specifications to Multi-Label MobileNetV2 (5 Classes):**  
   Update model requirements to MobileNetV2 with a 5-output sigmoid multi-label head (`Acne`, `Dark_Circles`, `Dry_Skin`, `Oily_Skin`, `Post-Inflammatory_hyperpigmentation`). Remove `Redness` from active deliverables.
4. **Specify Automated Multi-Angle Quality-Gated Capture Flow:**  
   Replace generic photo upload requirements with the 3-angle sequential capture protocol (Front, Left ¾, Right ¾) requiring automated gating for face centering (width >=120px), lighting (brightness 35–230), sharpness (Laplacian variance >=25), and stability (12 consecutive frames).
5. **Redefine LLM Requirements for On-Device Embedded Execution:**  
   Remove all references to Ollama, OpenAI, or cloud LLM APIs. Specify an embedded on-device inference engine (`llama.cpp` or `MLC-LLM`) running quantized 1B–4B parameter models with strict non-diagnostic system prompt constraints.
6. **Replace Cloud Database with Local On-Device Persistence:**  
   Remove requirements for cloud-hosted database schemas (PostgreSQL / MongoDB / Firebase) for user scans. Specify local encrypted on-device storage (SQLite / Room / Core Data / AsyncStorage) for `SessionSummary` and `UserProfile` entities.
7. **Redefine Cloud Scope Exclusively to Identity Management (Supabase Auth):**  
   Clarify that any network-permitted backend is strictly isolated to account registration and credential management (e.g. Supabase Auth), with zero access to biometric records, scans, or images.
8. **Add Android Native Inference Bridge Requirement (TFLite Parity):**  
   Include an explicit requirement for an Android native Expo module providing TensorFlow Lite inference parity with the existing iOS Core ML module (`RevelaVisionModule.swift`).
9. **Incorporate Fitzpatrick Phototype Fairness and Evaluation Standards:**  
   Add non-functional requirements mandating model evaluation across Fitzpatrick skin phototypes I through VI to prevent bias and ensure equitable detection accuracy across diverse skin tones.
10. **Establish Explicit Non-Diagnostic Cosmetic Compliance Disclaimers:**  
    Formalize regulatory and product safety boundaries: Révéla is strictly an informational cosmetic feedback tool, not a medical or dermatological diagnostic device. All scan summaries and LLM-generated routines must present visible non-medical disclaimers.
