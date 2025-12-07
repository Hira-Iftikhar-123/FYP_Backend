from src import models
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from sqlalchemy.orm import Session
from src.model_alert import service, crud, swin_model,schemas
from db import SessionLocal

router = APIRouter(prefix="/api/v1", tags=["model_alert"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/trigger-alert")
async def trigger_alert(payload: schemas.TriggerAlertPayload, db: Session = Depends(get_db)):
    try:
        result = await service.trigger_alert(payload, db)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/detect", response_model=schemas.DetectResponse)
async def detect(
    video: UploadFile = File(...),
    camera_id: int = 1,
    db: Session = Depends(get_db)
):
    try:
        result = await service.detect(video, camera_id, db)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/health")
async def health_check():
    return {"status": "ok"}