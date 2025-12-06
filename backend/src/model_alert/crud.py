from typing import List, Sequence

from sqlalchemy.orm import Session

from src.model_alert import models


def get_user(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.user_id == user_id).first()


def get_camera(db: Session, camera_id: int) -> models.Camera | None:
    return db.query(models.Camera).filter(models.Camera.camera_id == camera_id).first()


def create_alert(
    db: Session,
    *,
    camera: models.Camera,
    recipient: models.User,
    event_type: str,
    confidence_score: float | None,
    status: str = "pending",
    method: str = "model",
    user_id: int | None = None,
) -> models.Alert:
    alert = models.Alert(
        camera_id=camera.camera_id,
        user_id=user_id,
        sent_to_INT=recipient.user_id,
        event_type=event_type,
        confidence_score=confidence_score,
        method=method,
        status=status,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def create_event_media(
    db: Session,
    *,
    alert: models.Alert,
    media_urls: Sequence[str],
    media_type: str,
) -> List[models.EventMedia]:
    items: list[models.EventMedia] = []
    for url in media_urls:
        item = models.EventMedia(
            alert_id=alert.alert_id,
            media_url=url,
            media_type=media_type,
        )
        db.add(item)
        items.append(item)

    db.commit()
    for item in items:
        db.refresh(item)
    return items