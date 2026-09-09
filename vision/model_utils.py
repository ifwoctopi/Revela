import os

import torch
import torch.nn as nn
from torchvision import models, transforms


IMAGE_SIZE = 224
CLASS_THRESHOLD = 0.5


def classes_from_directory(directory):
    return sorted(
        name for name in os.listdir(directory)
        if os.path.isdir(os.path.join(directory, name))
    )


def build_model(num_classes, pretrained=False):
    weights = models.MobileNet_V2_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.mobilenet_v2(weights=weights)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    return model


def image_transform(train=False):
    steps = [transforms.Resize((IMAGE_SIZE, IMAGE_SIZE))]
    if train:
        steps.append(transforms.RandomHorizontalFlip())
    steps.extend([
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])
    return transforms.Compose(steps)


def load_checkpoint(path, device):
    checkpoint = torch.load(path, map_location=device)
    if "state_dict" in checkpoint:
        classes = checkpoint["classes"]
        state_dict = checkpoint["state_dict"]
    else:
        raise ValueError(
            "Checkpoint has no class metadata. Retrain with main.py before inference."
        )
    model = build_model(len(classes))
    model.load_state_dict(state_dict)
    return model.to(device), classes


def aggregate_angle_predictions(angle_probabilities, classes):
    """Use the strongest per-condition confidence across captured face angles."""
    if not angle_probabilities:
        return {}
    return {
        condition: max(probabilities)
        for condition, probabilities in zip(classes, zip(*angle_probabilities))
    }