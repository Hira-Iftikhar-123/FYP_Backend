from datetime import datetime
from typing import Any, Dict, Sequence

from firebase_admin import messaging
from sqlalchemy.orm import Session

from . import crud, models


def send_fcm_alert(fcm_token: str, alert_data: Dict[str, Any]) -> bool:
    if not fcm_token:
        return False

    message = messaging.Message(
        token=fcm_token,
        notification=messaging.Notification(
            title=alert_data.get("title", "Security Alert"),
            body=alert_data.get("body", ""),
        ),
        data={k: str(v) for k, v in alert_data.items() if isinstance(v, (str, int, float))},
    )

    try:
        messaging.send(message)
        return True
    except Exception:
        return False


def create_and_send_alert(
    db: Session,
    *,
    camera_id: int,
    event_type: str,
    confidence: float | None,
    media_urls: Sequence[str],
    media_type: str = "video",
) -> models.Alert:
    camera = crud.get_camera(db, camera_id=camera_id)
    if camera is None:
        raise ValueError("Camera not found")

    recipient = db.query(models.User).first()
    if recipient is None:
        raise ValueError("No user configured to receive alerts")

    alert = crud.create_alert(
        db,
        camera=camera,
        recipient=recipient,
        event_type=event_type,
        confidence_score=confidence,
        status="pending",
        method="model",
    )

    if media_urls:
        crud.create_event_media(
            db,
            alert=alert,
            media_urls=media_urls,
            media_type=media_type,
        )

    alert_payload: Dict[str, Any] = {
        "title": f"{event_type.capitalize()} detected",
        "body": f"Camera {camera.location} | confidence {confidence:.2f}" if confidence is not None else "",
        "alert_id": alert.alert_id,
        "camera_id": camera.camera_id,
        "event_type": event_type,
    }

    sent_ok = send_fcm_alert(recipient.fcm_token or "", alert_payload)
    alert.status = "sent" if sent_ok else "failed"
    if sent_ok:
        alert.sent_at = datetime.utcnow()
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert