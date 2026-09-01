Révéla — Build Brief for GitHub Copilot

Use this as project context (e.g. drop into a COPILOT_INSTRUCTIONS.md, repo README, or paste into chat) when scaffolding the app. It describes what we're building, the architecture, and the order to build it in.

What this app is

Révéla is a mobile app (iOS + Android) that gives users personalized feedback on cosmetic skin conditions (acne, redness, dryness, hyperpigmentation) by:

Guiding the user through a multi-angle face capture (front, left 3/4, right 3/4) using on-device face landmark detection
Running a multi-label on-device vision model to classify which conditions are present, per angle
Aggregating multi-angle results into one session summary with regions
Feeding that summary, plus the user's local history/baseline, to an on-device LLM that generates natural-language feedback
Storing everything locally — no image, biometric, or health data ever leaves the device

Account creation and app/model updates are the only parts allowed to touch the network.

Core architectural constraints (do not violate these when generating code)
Fully offline core loop. Camera capture → vision inference → aggregation → LLM generation → local storage must work with zero network calls.
No sensitive data leaves the device. No image, embedding, or condition-history upload, ever, in the core loop.
On-device only for inference. Vision model: Core ML (iOS) / TFLite (Android). LLM: llama.cpp or MLC-LLM mobile bindings running a small quantized model (target 1–4B params; up to 7–8B only on high-end devices).
Multi-label, not single-label, classification. Sigmoid output per condition (independent present/absent + confidence), not softmax.


Suggested repo structure
revela/
  vision/                  # model training, conversion, evaluation (Python)
    train.py
    convert_coreml.py
    convert_tflite.py
    eval_multilabel.py
  mobile/
    ios/                    # Swift, Core ML, Vision framework
    android/                # Kotlin, TFLite, ML Kit
    shared/                 # if using shared logic (e.g. Rust/C++ core) — optional
  llm/
    prompts/                # system prompt templates, few-shot examples
    quantized_models/       # GGUF or MLC-compiled model artifacts (not raw weights in git)
  docs/
    architecture.md
    data_schema.md


Build order (suggested milestones)
Milestone 1 — Vision model pipeline
Convert existing MobileNetV2 classifier from single-label (softmax) to multi-label (sigmoid + BCE loss)
Re-label/verify dataset supports multi-hot labels per image
Train, evaluate per-condition precision/recall, and specifically evaluate performance across Fitzpatrick skin type buckets
Export to Core ML and TFLite; verify inference on-device matches Python eval numbers within tolerance

Milestone 2 — Guided capture flow
Integrate Vision framework (iOS) / ML Kit face detection (Android) for landmark detection
Implement pose estimation from landmarks (yaw/pitch) and tolerance-band matching for target angles (front, left 3/4, right 3/4)
Implement frame quality checks: brightness range, blur (Laplacian variance) threshold, face centering/size
Build the capture state machine: prompt → detect → validate pose → validate quality → capture → next angle
UI: live camera preview with angle prompts and capture feedback (haptic/visual)

Milestone 3 — Inference + aggregation
Wire captured frames into the on-device vision model
Implement aggregation logic: per-condition, take max confidence across angles, map to region, assign severity
Define and implement the session summary schema (see below)
Unit test aggregation logic against known/mocked model outputs (no camera/LLM needed for these tests)
Milestone 4 — On-device LLM integration
Integrate llama.cpp or MLC-LLM mobile bindings; pick and quantize a small model
Build prompt template that takes: current session summary + relevant history/baseline deltas + user preferences → structured feedback request
Constrain LLM output format (e.g., short structured sections) to keep small-model output reliable
Stream tokens to UI for responsiveness

Milestone 5 — Local history & personalization
Local DB schema (SQLite / Room / Core Data) for sessions, baseline, preferences
Baseline establishment logic (e.g., average of first N sessions per condition)
Trend computation (current vs. baseline/recent) to feed into LLM prompt
Preferences UI (condition focus, tone) wired into prompt construction

Milestone 6 — Account & update flow (network-permitted)
Auth/account creation (thin service, no health data in payloads)
App/model update delivery mechanism
Explicit boundary/interface so account service code cannot access session history or images (enforce in code structure, not just convention)
Data schema reference

Session summary (per capture session):

json
{
  "session_id": "uuid",
  "timestamp": "ISO8601",
  "angles_captured": ["front", "left_3q", "right_3q"],
  "results": {
    "acne": {"present": true, "confidence": 0.87, "region": "chin", "severity": "moderate"},
    "redness": {"present": true, "confidence": 0.65, "region": "left_cheek", "severity": "mild"},
    "dryness": {"present": false}
  }
}

User profile (local only):

json
{
  "user_id": "uuid",
  "baseline": {"acne": 0.3, "redness": 0.2, "dryness": 0.1},
  "preferences": {"focus": ["acne", "redness"], "tone": "casual"}
}

Notes for Copilot when generating code
Using React Native for Development
The AI and LLM are being developed in a seperate folder, to begin we will primarily be focusing on UI and prototyping in this folder.
Prefer sigmoid + per-class BCE loss over softmax for the vision model's classification head.
When generating camera/capture code, always gate frame acceptance on both pose tolerance and quality checks — don't accept the first frame at roughly the right angle.
When generating LLM prompt code, keep the system prompt scoped to descriptive/cosmetic language, not diagnostic/medical language.
Keep vision inference, LLM inference, and camera capture on separate threads/queues so none blocks the UI or each other.
Do not introduce any network calls inside the vision inference, aggregation, LLM generation, or local storage code paths.