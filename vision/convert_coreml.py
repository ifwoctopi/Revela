"""Convert the trained PyTorch classifier to an iOS Core ML package."""

import argparse
import json
from pathlib import Path

import coremltools as ct
import torch
import torch.nn as nn

from model_utils import IMAGE_SIZE, load_checkpoint


class CoreMLClassifier(nn.Module):
    def __init__(self, model: nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        mean = image.new_tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
        std = image.new_tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
        normalized = (image - mean) / std
        return torch.sigmoid(self.model(normalized))


def convert(checkpoint: Path, output: Path, model_format: str) -> None:
    model, classes = load_checkpoint(str(checkpoint), torch.device("cpu"))
    model.eval()
    wrapped = CoreMLClassifier(model).eval()
    example = torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE)
    traced = torch.jit.trace(wrapped, example)

    conversion_options = {
        "convert_to": model_format,
        "inputs": [
            ct.ImageType(
                name="image",
                shape=example.shape,
                color_layout=ct.colorlayout.RGB,
                scale=1 / 255.0,
            )
        ],
        "outputs": [ct.TensorType(name="probabilities")],
    }
    if model_format == "mlprogram":
        conversion_options["minimum_deployment_target"] = ct.target.iOS16
    else:
        conversion_options["minimum_deployment_target"] = ct.target.iOS14

    coreml_model = ct.convert(
        traced,
        **conversion_options,
    )
    coreml_model.author = "Revela vision pipeline"
    coreml_model.short_description = "Offline multi-label cosmetic skin classifier"
    coreml_model.version = "1"
    coreml_model.user_defined_metadata["classes"] = json.dumps(classes)
    coreml_model.user_defined_metadata["threshold"] = "0.5"
    coreml_model.user_defined_metadata["input_size"] = str(IMAGE_SIZE)
    coreml_model.save(str(output))
    print(f"Saved Core ML model to {output}")
    print(f"Classes: {', '.join(classes)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=Path("skin_model_weights.pth"))
    parser.add_argument("--output", type=Path, default=Path("exports/skin_model.mlmodel"))
    parser.add_argument(
        "--format",
        choices=["neuralnetwork", "mlprogram"],
        default="neuralnetwork",
        help="Use neuralnetwork on Windows; mlprogram requires macOS Core ML tooling.",
    )
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    convert(args.checkpoint, args.output, args.format)
