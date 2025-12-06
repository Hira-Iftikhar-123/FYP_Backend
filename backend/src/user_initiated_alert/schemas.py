from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class UserInitiatedAlertCreateSchema(BaseModel):
    camera_id: int = Field(..., description="ID of the camera where the alert was initiated")
    event_type: str = Field(..., description="Event type triggering the alert")
    status: str = Field(..., description="Alert status")
    sent_at: Optional[datetime] = Field(default=None, description="Time the alert was sent")

class UserInitiatedAlertResponseSchema(BaseModel):
    alert_id: int = Field(..., description="Unique ID for the alert")
    camera_id: int
    event_type: str
    status: str
    sent_at: Optional[datetime]
    timestamp: datetime

    class Config:
        from_attributes = True
class SocketMessage(BaseModel):
    event_type: str
    payload: dict
