from typing import List, Optional

import firebase_admin
from fastapi import Depends, FastAPI, HTTPException, UploadFile, File
from firebase_admin import credentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import torch
import torch.nn.functional as F
import json
import os
import numpy as np
import time 

from . import alert_service, models
from .database import Base, SessionLocal, engine
from .extract_frames import extract_frames
from .swin_model import ViolenceSwin3D

NORM_MEAN = np.array([0.485, 0.456, 0.406]).astype(np.float32)
NORM_STD = np.array([0.229, 0.224, 0.225]).astype(np.float32)


class TriggerAlertPayload(BaseModel):
    camera_id: int = Field(..., description="ID of the camera that triggered the event")
    event_type: str = Field(..., description="Event type: theft, violence, manual_report")
    media_urls: List[str] = Field(
        default_factory=list,
        description="List of media URLs (video/image) associated with the alert",
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI(title="Realtime Theft and Violence Detection")

_classes_path = os.path.join(os.path.dirname(__file__), "classes.json")
_raw_classes = json.load(open(_classes_path))
if isinstance(_raw_classes, dict):
    CLASSES = {int(k): v for k, v in _raw_classes.items()}
else:
    CLASSES = {idx: label for idx, label in enumerate(_raw_classes)}
    
device = "cuda" if torch.cuda.is_available() else "cpu"

model = ViolenceSwin3D(num_classes=len(CLASSES)).to(device) 

CHECKPOINT_FILE = "muhafiz_swin3d_final.pth"
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_checkpoint_path = os.path.join(_project_root, "backend", "model", CHECKPOINT_FILE)
checkpoint = torch.load(_checkpoint_path, map_location=device)
if isinstance(checkpoint, dict) and "model_state" in checkpoint:
    state_dict = checkpoint["model_state"]
else:
    state_dict = checkpoint

model.load_state_dict(state_dict, strict=False)
model.eval()

# Define Mapping for Alert Triggering (6 prediction classes -> 3 alert types)
PREDICTION_TO_ALERT_MAP = {
    "violence": "violence",
    "normal": "normal",
    "shoplifting": "theft",
    "stealing": "theft",
    "robbery": "theft",
    "burglary": "theft",
}


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

    if not firebase_admin._apps:
        try:
            _project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            _firebase_creds_path = os.path.join(
                _project_root,
                "firebase_credentials.json",
            )
            if os.path.exists(_firebase_creds_path):
                cred = credentials.Certificate(_firebase_creds_path)
                firebase_admin.initialize_app(cred)
        except Exception:
            pass


@app.post("/api/v1/trigger-alert")
def trigger_alert(
    payload: TriggerAlertPayload,
    db: Session = Depends(get_db),
):
    valid_types = {"theft", "violence", "manual_report", "normal"} 
    if payload.event_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_type. Must be one of {sorted(valid_types)}",
        )
    
    if payload.event_type in {"theft", "violence", "manual_report"}:
        try:
            alert = alert_service.create_and_send_alert(
                db,
                camera_id=payload.camera_id,
                event_type=payload.event_type,
                media_urls=payload.media_urls,
                media_type="video",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        return {"alert_id": alert.alert_id, "status": alert.status}
    
    return {"status": "No alert triggered (Normal behavior detected)"}


@app.post("/api/v1/detect")
async def detect(
    video: UploadFile = File(...), 
    camera_id: int = 1,
):
    video_bytes = await video.read()

    try:
        # Frames are extracted as (T, H, W, C) numpy array of uint8 [0-255]
        frames, duration = extract_frames(
            video_bytes,
            num_frames=16,
            min_duration_s=5.0,
            max_duration_s=10.0,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    frames = torch.tensor(frames, dtype=torch.float32)
    
    # 1. Scale to [0, 1] and Permute to (T, C, H, W)
    frames = frames.permute(0, 3, 1, 2) / 255.0 
    
    # 2. Reshape to (1, C, T, H, W) for 3D model input
    frames = frames.unsqueeze(0) # (1, T, C, H, W)
    frames = frames.permute(0, 2, 1, 3, 4) # (1, C, T, H, W)
    
    # 3. Interpolate/Resize (kept for compatibility with original code's resize expectation)
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

    inference_start = time.perf_counter()
    with torch.no_grad():
        if device == "cuda":
            torch.cuda.synchronize() 
            with torch.amp.autocast(device_type="cuda"):
                logits = model(frames)
            torch.cuda.synchronize() 
        else:
            logits = model(frames)

        probs = F.softmax(logits, dim=1)
        conf, pred = torch.max(probs, dim=1)
    inference_end = time.perf_counter()
    inference_time = inference_end - inference_start
        
    predicted_label = CLASSES[int(pred.item())]
    
    alert_event_type = PREDICTION_TO_ALERT_MAP.get(predicted_label, "normal")
    
    return {
        "prediction": predicted_label, 
        "alert_type": alert_event_type,
        "clip_duration_seconds": round(float(duration), 2),
        "inference_time_seconds": round(inference_time, 4),
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}