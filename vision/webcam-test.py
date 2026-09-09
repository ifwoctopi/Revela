import cv2
import torch
from PIL import Image
from model_utils import image_transform, load_checkpoint, aggregate_angle_predictions

# ---------------------------
# 1. Load trained model
# ---------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
threshold = 0.5
required_stable_frames = 12
minimum_face_size = 120
minimum_brightness = 35
maximum_brightness = 230
minimum_sharpness = 25

model, class_names = load_checkpoint("skin_model_weights.pth", device)
model.eval()

# ---------------------------
# 2. Define preprocessing
# ---------------------------
transform = image_transform()

front_detector = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
profile_detector = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_profileface.xml"
)


# ---------------------------
# 3. Open webcam
# ---------------------------
cap = cv2.VideoCapture(0)
angles = [
    ("front", "Look straight at the camera", "front"),
    ("left_3q", "Turn your head to the left", "left"),
    ("right_3q", "Turn your head to the right", "right"),
]
angle_index = 0
stable_frames = 0
angle_probabilities = []
report = None

while True:
    ret, frame = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if report is None:
        angle_name, prompt, required_pose = angles[angle_index]
        faces = []
        if required_pose == "front":
            faces.extend(
                (x, y, width, height, "front")
                for x, y, width, height in front_detector.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=5
                )
            )
        else:
            profile_faces = profile_detector.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5
            )
            faces.extend(
                (x, y, width, height, "left")
                for x, y, width, height in profile_faces
            )
            flipped_gray = cv2.flip(gray, 1)
            mirrored_faces = profile_detector.detectMultiScale(
                flipped_gray, scaleFactor=1.1, minNeighbors=7
            )
            faces.extend(
                (gray.shape[1] - x - width, y, width, height, "right")
                for x, y, width, height in mirrored_faces
            )

        matching_faces = [face for face in faces if face[4] == required_pose]
        label = prompt
        status = "Adjust position"
        if matching_faces:
            x, y, width, height, _ = max(
                matching_faces, key=lambda box: box[2] * box[3]
            )
            face_gray = gray[y:y + height, x:x + width]
            sharpness = cv2.Laplacian(face_gray, cv2.CV_64F).var()
            brightness = face_gray.mean()
            quality_ok = (
                width >= minimum_face_size
                and minimum_brightness <= brightness <= maximum_brightness
                and sharpness >= minimum_sharpness
            )
            status = (
                f"Hold still {stable_frames}/{required_stable_frames}"
                if quality_ok else "Improve lighting or focus"
            )
            stable_frames = stable_frames + 1 if quality_ok else 0

            padding = int(max(width, height) * 0.15)
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(frame.shape[1], x + width + padding)
            y2 = min(frame.shape[0], y + height + padding)
            face = frame[y1:y2, x1:x2]
            img = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
            input_image = Image.fromarray(img)
            input_tensor = transform(input_image).unsqueeze(0).to(device)

            with torch.no_grad():
                probabilities = torch.sigmoid(model(input_tensor))[0].cpu().tolist()

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            if stable_frames >= required_stable_frames:
                angle_probabilities.append(probabilities)
                angle_index += 1
                stable_frames = 0
                if angle_index == len(angles):
                    report = aggregate_angle_predictions(angle_probabilities, class_names)
                continue
        cv2.putText(frame, f"Step {angle_index + 1}/{len(angles)}: {prompt}",
                    (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.putText(frame, status, (10, 65),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    else:
        cv2.putText(frame, "Face analysis report", (10, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        report_lines = [
            f"{condition}: {confidence:.0%}"
            for condition, confidence in report.items()
            if confidence >= threshold
        ] or ["No condition above threshold"]
        for line_index, line in enumerate(report_lines):
            cv2.putText(frame, line, (10, 75 + line_index * 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)

    cv2.imshow("Skin Condition Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
