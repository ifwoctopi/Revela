# Mobile model integration

## Current model contract

The trained artifact is `vision/skin_model_weights.pth`. It is a MobileNetV2
classifier with five independent logits. Apply sigmoid to each logit and use
`0.5` as the initial presence threshold. The exact input contract is:

- RGB image resized to `224 x 224`
- Tensor layout `NCHW`
- ImageNet normalization: mean `[0.485, 0.456, 0.406]`, standard deviation `[0.229, 0.224, 0.225]`
- Classes, in checkpoint order: `Acne`, `Dark_Circles`, `Dry_Skin`, `Oily_Skin`, `Post-Inflammatory_hyperpigmentation`

Create an intermediate artifact with:

```powershell
cd vision
python export_model.py --checkpoint skin_model_weights.pth --output-dir exports
```

The export writes a TorchScript graph and metadata. The native mobile layer
must convert or load that graph with Core ML on iOS and TFLite on Android.

## Mobile capture flow

`mobile/skubba-mobile-app/app/capture.tsx` currently captures front, left
three-quarter, and right three-quarter images locally. It is intentionally a
camera-only development slice. Before production inference, add a native
capture coordinator that accepts an image only when all of these are true:

- face pose matches the requested angle
- face width is at least 120 pixels
- brightness is between 35 and 230
- Laplacian sharpness is at least 25
- the frame remains valid for 12 consecutive frames

The classifier output should be aggregated with the maximum confidence per
class across the three accepted frames, matching `aggregate_angle_predictions`
in `vision/model_utils.py`.

## Category mapping

The model's categories do not exactly match the current UI schema. Do not
silently rename them. Map them explicitly in the result adapter, or update the
UI schema to support `dark_circles` and `oily_skin`. `redness` is not an output
of this model and must not be inferred from another class.

The core capture, inference, aggregation, and storage path must remain local.