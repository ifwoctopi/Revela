"""Checks the converted ONNX model against an independent PyTorch interpretation of the
Core ML layer graph (different code path from the converter), on random and synthetic images.

This cannot prove parity with Core ML itself, which only runs on macOS. To do that, run
the same images through the iOS module and compare with the numbers printed here.

Usage (repo root): python tools/skin-model/verify_onnx.py [image.jpg ...]
"""

import sys
from pathlib import Path

import coremltools as ct
import numpy as np
import onnxruntime as ort
import torch
import torch.nn.functional as F
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPEC = ct.models.MLModel(str(ROOT / "mobile/modules/revela-vision/ios/skin_model.mlmodel"), skip_model_load=True).get_spec()
SESSION = ort.InferenceSession(str(ROOT / "mobile/assets/models/skin_model.onnx"))


def reference(pixels: np.ndarray) -> np.ndarray:
    """Runs the Core ML layers one by one with torch ops. pixels: [1,3,224,224], 0-255."""
    nn = SPEC.neuralNetwork
    t = {SPEC.description.input[0].name: torch.from_numpy(pixels) * nn.preprocessing[0].scaler.channelScale}
    for layer in nn.layers:
        kind = layer.WhichOneof("layer")
        d = getattr(layer, kind)
        x = [t[i] for i in layer.input]
        out = layer.output[0]
        if kind == "loadConstantND":
            t[out] = torch.tensor(list(d.data.floatValue)).reshape(list(d.shape))
        elif kind == "activation":
            t[out] = torch.sigmoid(x[0]) if d.WhichOneof("NonlinearityType") == "sigmoid" else x[0] * d.linear.alpha + d.linear.beta
        elif kind == "add":
            t[out] = x[0] + x[1] if len(x) == 2 else x[0] + d.alpha
        elif kind == "multiply":
            t[out] = x[0] * x[1] if len(x) == 2 else x[0] * d.alpha
        elif kind == "clip":
            t[out] = x[0].clamp(d.minVal, d.maxVal)
        elif kind == "convolution":
            kh, kw = d.kernelSize
            w = torch.tensor(list(d.weights.floatValue)).reshape(d.outputChannels, d.kernelChannels, kh, kw)
            b = torch.tensor(list(d.bias.floatValue)) if d.hasBias else None
            amounts = d.valid.paddingAmounts.borderAmounts
            top, left, bottom, right = (
                (amounts[0].startEdgeSize, amounts[1].startEdgeSize, amounts[0].endEdgeSize, amounts[1].endEdgeSize)
                if len(amounts) == 2 else (0, 0, 0, 0)
            )
            padded = F.pad(x[0], (left, right, top, bottom))
            t[out] = F.conv2d(padded, w, b, stride=tuple(d.stride), groups=d.nGroups)
        elif kind == "pooling":
            t[out] = x[0].mean(dim=(2, 3), keepdim=True)
        elif kind == "reshapeStatic":
            t[out] = x[0].reshape(list(d.targetShape))
        elif kind == "innerProduct":
            w = torch.tensor(list(d.weights.floatValue)).reshape(d.outputChannels, d.inputChannels)
            t[out] = x[0] @ w.T + torch.tensor(list(d.bias.floatValue))
        else:
            raise SystemExit(f"unsupported {kind}")
    return t[SPEC.description.output[0].name].numpy()


def load(path: str) -> np.ndarray:
    img = Image.open(path).convert("RGB").resize((224, 224), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32).transpose(2, 0, 1)[None]


def main():
    rng = np.random.default_rng(0)
    samples = {f"random{i}": rng.uniform(0, 255, (1, 3, 224, 224)).astype(np.float32) for i in range(3)}
    samples["flat-skin-tone"] = np.broadcast_to(np.array([200, 150, 130], np.float32)[None, :, None, None], (1, 3, 224, 224)).copy()
    samples.update({Path(p).name: load(p) for p in sys.argv[1:]})

    classes = ["Acne", "Dark_Circles", "Dry_Skin", "Oily_Skin", "Post-Inflammatory_hyperpigmentation"]
    worst = 0.0
    for name, pixels in samples.items():
        got = SESSION.run(None, {"image": pixels})[0][0]
        want = reference(pixels)[0]
        worst = max(worst, float(np.abs(got - want).max()))
        print(f"{name:>20}: " + "  ".join(f"{c.split('_')[0][:6]}={v:.3f}" for c, v in zip(classes, got)))
    print(f"max |onnx - reference| = {worst:.2e}")
    if worst > 1e-3:
        raise SystemExit("MISMATCH")


if __name__ == "__main__":
    main()
