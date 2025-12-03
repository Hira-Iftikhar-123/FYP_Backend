from typing import List, Optional

import firebase_admin
from fastapi import Depends, FastAPI, HTTPException, UploadFile, File
from firebase_admin import credentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import torch
import torch.nn.functional as F
import json

from . import alert_service, models
from .database import Base, SessionLocal, engine
from .swin_model import ViolenceSwin3D
from .extract_frames import extract_frames


class TriggerAlertPayload(BaseModel):
    camera_id: int = Field(..., description="ID of the camera that triggered the event")
    event_type: str = Field(..., description="Event type: theft, violence, manual_report")
    confidence: Optional[float] = Field(
        None, description="Model confidence score for the event"
    )
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


app = FastAPI(title="Realtime Theft and Violence Detection Alert API")

_raw_classes = json.load(open("app/classes.json"))
if isinstance(_raw_classes, dict):
    CLASSES = {int(k): v for k, v in _raw_classes.items()}
else:
    CLASSES = {idx: label for idx, label in enumerate(_raw_classes)}
device = "cuda" if torch.cuda.is_available() else "cpu"
model = ViolenceSwin3D(num_classes=len(CLASSES)).to(device)

checkpoint = torch.load(
    "../backend/model/rwf_ucf_combined_epoch5.pth", map_location=device
)
if isinstance(checkpoint, dict) and "model_state" in checkpoint:
    state_dict = checkpoint["model_state"]
else:
    state_dict = checkpoint

model.load_state_dict(state_dict, strict=False)
model.eval()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

    if not firebase_admin._apps:
        try:
            cred = credentials.Certificate("firebase_credentials.json")
            firebase_admin.initialize_app(cred)
        except Exception:
            pass


@app.post("/api/v1/trigger-alert")
def trigger_alert(
    payload: TriggerAlertPayload,
    db: Session = Depends(get_db),
):
    valid_types = {"theft", "violence", "manual_report"}
    if payload.event_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_type. Must be one of {sorted(valid_types)}",
        )

    try:
        alert = alert_service.create_and_send_alert(
            db,
            camera_id=payload.camera_id,
            event_type=payload.event_type,
            confidence=payload.confidence,
            media_urls=payload.media_urls,
            media_type="video",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"alert_id": alert.alert_id, "status": alert.status}


@app.post("/api/v1/detect")
async def detect(video: UploadFile = File(...)):
    video_bytes = await video.read()

    try:
        frames, duration = extract_frames(
            video_bytes,
            num_frames=16,
            min_duration_s=5.0,
            max_duration_s=10.0,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    frames = torch.tensor(frames, dtype=torch.float32)
    frames = frames.permute(0, 3, 1, 2)
    frames = frames / 255.0
    frames = frames.unsqueeze(0)
    frames = frames.permute(0, 2, 1, 3, 4)

    _, C, T, H, W = frames.shape
    frames = torch.nn.functional.interpolate(
        frames,
        size=(T, 224, 224),
        mode="trilinear",
        align_corners=False,
    )

    frames = frames.to(device)

    with torch.no_grad():
        if device == "cuda":
            with torch.amp.autocast(device_type="cuda"):
                logits = model(frames)
        else:
            logits = model(frames)

        probs = F.softmax(logits, dim=1)
        conf, pred = torch.max(probs, dim=1)

    return {
        "prediction": CLASSES[int(pred.item())],
        "confidence": float(conf.item()),
        "clip_duration_seconds": round(float(duration), 2),
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}