from datetime import datetime
from db import SessionLocal
from src.model_alert.models import Alert  # adjust import if needed

async def create_alert(alert_dict):
    db = SessionLocal()

    try:
        new_alert = Alert(
            camera_id=alert_dict.camera_id,
            event_type=alert_dict.event_type,
            status=alert_dict.status,
            sent_at=alert_dict.sent_at,
            timestamp=datetime.utcnow()
        )

        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)

        return new_alert

    except Exception as e:
        db.rollback()
        raise e

    finally:
        db.close()
