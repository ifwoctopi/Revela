# Révéla architecture

## Product flow

1. Capture a face image from the front, left 3/4, and right 3/4 angles.
2. Run on-device face detection and quality checks for pose, blur, and brightness.
3. Perform multi-label skin-condition inference using a sigmoid-based model.
4. Aggregate per-angle results into a session summary.
5. Feed the summary and local history/baseline into an on-device LLM.
6. Store the final summary and profile locally, with no sensitive data leaving the device.

## Repository layout

- `mobile/`: React Native / Expo app for UI prototyping and the end-user experience.
- `vision/`: training, conversion, and evaluation scripts for the multi-label skin classifier.
- `llm/`: prompt templates and quantized model assets.
- `docs/`: product and system documentation.

## Mobile architecture notes

- Keep camera capture, inference, and LLM generation on separate execution paths from the UI.
- Use local-only storage for session history and profile data.
- Treat account creation and updates as the only network boundary in the app.
