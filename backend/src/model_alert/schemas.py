from pydantic import BaseModel, Field
from typing import List, Optional

class TriggerAlertPayload(BaseModel):
    camera_id: int = Field(..., description="ID of the camera that triggered the event")
    event_type: str = Field(..., description="Event type: theft, violence, manual_report")
    confidence: Optional[float] = Field(None, description="Model confidence score for the event")
    media_urls: List[str] = Field(default_factory=list, description="List of media URLs associated with the alert")

class AlertResponse(BaseModel):
    alert_id: int
    status: str

class DetectResponse(BaseModel):
    prediction: str
    alert_type: str
    confidence: float
    clip_duration_seconds: float
    alert_status: str