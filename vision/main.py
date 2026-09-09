import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import os
from PIL import Image
from model_utils import classes_from_directory, image_transform, build_model

# ---------- Parameters ----------
train_dir = "scin-filter/cosmetic_dataset_split/train"
val_dir = "scin-filter/cosmetic_dataset_split/val"
batch_size = 16
num_epochs = 25
learning_rate = 1e-4
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ---------- Data transforms ----------
train_transforms = image_transform(train=True)
val_transforms = image_transform()

# ---------- Datasets & loaders ----------
class MultiLabelImageDataset(Dataset):
    def __init__(self, root_dir, classes, transform=None):
        self.root_dir = root_dir
        self.classes = classes
        self.transform = transform
        class_to_index = {name: index for index, name in enumerate(self.classes)}
        images = {}

        for class_name in self.classes:
            class_dir = os.path.join(root_dir, class_name)
            for filename in os.listdir(class_dir):
                path = os.path.join(class_dir, filename)
                if not os.path.isfile(path):
                    continue
                if filename not in images:
                    images[filename] = {
                        "path": path,
                        "labels": torch.zeros(len(self.classes), dtype=torch.float32),
                    }
                images[filename]["labels"][class_to_index[class_name]] = 1.0

        self.samples = list(images.values())

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        sample = self.samples[index]
        image = Image.open(sample["path"]).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, sample["labels"]


train_classes = set(classes_from_directory(train_dir))
val_classes = set(classes_from_directory(val_dir))
if train_classes != val_classes:
    raise ValueError(
        "Train and validation folders must contain the same classes. "
        f"Only in train: {sorted(train_classes - val_classes)}; "
        f"only in val: {sorted(val_classes - train_classes)}"
    )
classes = sorted(train_classes)
train_dataset = MultiLabelImageDataset(train_dir, classes, transform=train_transforms)
val_dataset = MultiLabelImageDataset(val_dir, classes, transform=val_transforms)

# Compute class weights to handle imbalance
positive_counts = torch.zeros(len(train_dataset.classes), dtype=torch.float32)
for _, labels in train_dataset:
    positive_counts += labels
negative_counts = len(train_dataset) - positive_counts
pos_weight = (negative_counts / positive_counts.clamp_min(1)).to(device)

train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=batch_size)

num_classes = len(train_dataset.classes)
print("Classes:", classes)

# ---------- Model ----------
model = build_model(num_classes, pretrained=True)
model = model.to(device)

# ---------- Loss & optimizer ----------
criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
optimizer = optim.Adam(model.parameters(), lr=learning_rate)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=3)
best_val_f1 = -1.0

# ---------- Training loop ----------
for epoch in range(num_epochs):
    model.train()
    running_loss = 0.0
    train_true_positives = torch.zeros(num_classes)
    train_false_positives = torch.zeros(num_classes)
    train_false_negatives = torch.zeros(num_classes)

    for inputs, labels in train_loader:
        inputs, labels = inputs.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        predictions = outputs.sigmoid() >= 0.5
        train_true_positives += (predictions & labels.bool()).sum(dim=0).cpu()
        train_false_positives += (predictions & ~labels.bool()).sum(dim=0).cpu()
        train_false_negatives += (~predictions & labels.bool()).sum(dim=0).cpu()

    train_loss = running_loss / len(train_dataset)

    # ---------- Validation ----------
    model.eval()
    val_loss = 0.0
    val_true_positives = torch.zeros(num_classes)
    val_false_positives = torch.zeros(num_classes)
    val_false_negatives = torch.zeros(num_classes)
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            val_loss += loss.item() * inputs.size(0)
            predictions = outputs.sigmoid() >= 0.5
            val_true_positives += (predictions & labels.bool()).sum(dim=0).cpu()
            val_false_positives += (predictions & ~labels.bool()).sum(dim=0).cpu()
            val_false_negatives += (~predictions & labels.bool()).sum(dim=0).cpu()

    val_loss /= len(val_dataset)
    train_precision = train_true_positives / (
        train_true_positives + train_false_positives
    ).clamp_min(1)
    train_recall = train_true_positives / (
        train_true_positives + train_false_negatives
    ).clamp_min(1)
    train_f1 = (2 * train_precision * train_recall / (
        train_precision + train_recall
    ).clamp_min(1e-8)).mean().item()
    val_precision = val_true_positives / (
        val_true_positives + val_false_positives
    ).clamp_min(1)
    val_recall = val_true_positives / (
        val_true_positives + val_false_negatives
    ).clamp_min(1)
    val_f1_per_class = 2 * val_precision * val_recall / (
        val_precision + val_recall
    ).clamp_min(1e-8)
    val_f1 = val_f1_per_class.mean().item()

    scheduler.step(val_loss)

    print(f"Epoch {epoch+1}/{num_epochs} | "
          f"Train Loss: {train_loss:.4f}, Train F1: {train_f1:.4f} | "
          f"Val Loss: {val_loss:.4f}, Val F1: {val_f1:.4f}")
    print("Val F1 by class:", {
        class_name: round(score.item(), 4)
        for class_name, score in zip(classes, val_f1_per_class)
    })

    if val_f1 > best_val_f1:
        best_val_f1 = val_f1
        torch.save(
            {"state_dict": model.state_dict(), "classes": classes},
            "skin_model_weights.pth",
        )

print("Training complete!")
