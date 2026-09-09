"""Export the trained classifier for a native mobile inference runtime.

The generated TorchScript file is an intermediate artifact. iOS and Android
adapters should convert or load the same graph with their native runtimes.
"""

import argparse
import json
from pathlib import Path

import torch

from model_utils import IMAGE_SIZE, build_model, load_checkpoint


def export(checkpoint_path: Path, output_dir: Path) -> None:
    device = torch.device("cpu")
    model, classes = load_checkpoint(str(checkpoint_path), device)
    model.eval()

    output_dir.mkdir(parents=True, exist_ok=True)
    example = torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE, device=device)
    traced = torch.jit.trace(model, example)
    traced.save(str(output_dir / "skin_model.torchscript.pt"))

    metadata = {
        "input": {
            "shape": [1, 3, IMAGE_SIZE, IMAGE_SIZE],
            "layout": "NCHW",
            "color": "RGB",
            "normalization": {
                "mean": [0.485, 0.456, 0.406],
                "std": [0.229, 0.224, 0.225],
            },
        },
        "output": {"type": "logits", "activation": "sigmoid", "threshold": 0.5},
        "classes": classes,
        "checkpoint": checkpoint_path.name,
    }
    (output_dir / "skin_model.metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=Path("skin_model_weights.pth"))
    parser.add_argument("--output-dir", type=Path, default=Path("exports"))
    args = parser.parse_args()
    export(args.checkpoint, args.output_dir)
    print(f"Exported model and metadata to {args.output_dir}")
