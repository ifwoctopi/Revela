# Révéla Mobile

Révéla is a non-diagnostic appearance-tracking prototype. It does **not** diagnose or screen for medical conditions. The app captures three face views, converts supported model outputs into non-medical appearance observations, stores structured history locally, builds personal baseline comparisons, tracks routines, and records optional journal context.

## Important Android note
The bundled `revela-vision` native module currently implements Core ML for iOS only. On Android, `services/vision.ts` uses clearly labeled prototype values so the UI/data flow can be tested. Do not present Android prototype values as real inference. Implement Android TFLite/ONNX inference before claiming live model analysis.

## Main structure
- `app/` routes/screens
- `components/` reusable UI
- `services/` inference, observations, storage, baseline logic
- `safety/` disclaimer text and language guardrails
- `types/` data contracts
- `modules/revela-vision/` native model bridge

## Run
`npm install`
`npx expo start --dev-client --localhost`

For a USB Android device: `adb reverse tcp:8081 tcp:8081`.
