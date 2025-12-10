import torch
import torch.nn.functional as F
import numpy as np
import os
import json
from fastapi import UploadFile
from sqlalchemy.orm import Session
import src.model_alert.alert_service as alert_service
from src.model_alert.extract_frames import extract_frames
from src.model_alert.swin_model import ViolenceSwin3D
from src.model_alert.schemas import TriggerAlertPayload

NORM_MEAN = np.array([0.485, 0.456, 0.406]).astype(np.float32)
NORM_STD = np.array([0.229, 0.224, 0.225]).astype(np.float32)

# Load classes
_classes_path = os.path.join(os.path.dirname(__file__), "classes.json")
_raw_classes = json.load(open(_classes_path))
if isinstance(_raw_classes, dict):
    CLASSES = {int(k): v for k, v in _raw_classes.items()}
else:
    CLASSES = {idx: label for idx, label in enumerate(_raw_classes)}

device = "cuda" if torch.cuda.is_available() else "cpu"

# Load model
model = ViolenceSwin3D(num_classes=len(CLASSES)).to(device)
CHECKPOINT_FILE = "final_crime_detector.pth"
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_checkpoint_path = os.path.join(_project_root, "models", CHECKPOINT_FILE)
checkpoint = torch.load(_checkpoint_path, map_location=device)
if isinstance(checkpoint, dict) and "model_state" in checkpoint:
    state_dict = checkpoint["model_state"]
else:
    state_dict = checkpoint
model.load_state_dict(state_dict, strict=False)
model.eval()

PREDICTION_TO_ALERT_MAP = {
    "violence": "violence",
    "normal": "normal",
    "shoplifting": "theft",
    "stealing": "theft",
    "robbery": "theft",
    "burglary": "theft",
}

async def trigger_alert(payload: TriggerAlertPayload, db: Session):
    valid_types = {"theft", "violence", "manual_report", "normal"}
    if payload.event_type not in valid_types:
        raise ValueError(f"Invalid event_type. Must be one of {sorted(valid_types)}")
    
    if payload.event_type in {"theft", "violence", "manual_report"}:
        alert = alert_service.create_and_send_alert(
            db,
            camera_id=payload.camera_id,
            event_type=payload.event_type,
            confidence=payload.confidence,
            media_urls=payload.media_urls,
            media_type="video",
        )
        return {"alert_id": alert.alert_id, "status": alert.status}
    
    return {"status": "No alert triggered (Normal behavior detected)"}

async def detect(video: UploadFile, camera_id: int, db: Session):
    video_bytes = await video.read()

    frames, duration = extract_frames(
        video_bytes,
        num_frames=16,
        min_duration_s=5.0,
        max_duration_s=10.0,
    )

    frames = torch.tensor(frames, dtype=torch.float32)
    frames = frames.permute(0, 3, 1, 2) / 255.0
    frames = frames.unsqueeze(0)
    frames = frames.permute(0, 2, 1, 3, 4)
    
    _, C, T, H, W = frames.shape
    frames = torch.nn.functional.interpolate(
        frames,
        size=(T, 224, 224),
        mode="trilinear",
        align_corners=False,
    )
    
    mean_tensor = torch.tensor(NORM_MEAN).reshape(1, 3, 1, 1, 1).to(frames.device)
    std_tensor = torch.tensor(NORM_STD).reshape(1, 3, 1, 1, 1).to(frames.device)
    frames = (frames - mean_tensor) / std_tensor

    frames = frames.to(device)

    with torch.no_grad():
        if device == "cuda":
            with torch.amp.autocast(device_type="cuda"):
                logits = model(frames)
        else:
            logits = model(frames)

        probs = F.softmax(logits, dim=1)
        conf, pred = torch.max(probs, dim=1)
        
    predicted_label = CLASSES[int(pred.item())]
    confidence = float(conf.item())
    alert_event_type = PREDICTION_TO_ALERT_MAP.get(predicted_label, "normal")
    
    if alert_event_type in {"theft", "violence"}:
        alert_payload = TriggerAlertPayload(
            camera_id=camera_id,
            event_type=alert_event_type,
            confidence=confidence,
            media_urls=[],
        )
        alert_response = await trigger_alert(alert_payload, db)
        alert_status = alert_response.get("status", "Alert Sent")
    else:
        alert_status = "Normal behavior detected (No alert sent)"

    return {
        "prediction": predicted_label,
        "alert_type": alert_event_type,
        "confidence": confidence,
        "clip_duration_seconds": round(float(duration), 2),
        "alert_status": alert_status,
    }