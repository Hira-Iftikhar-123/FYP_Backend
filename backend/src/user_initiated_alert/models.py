from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AlertBase(BaseModel):
    camera_id: int
    event_type: str
    status: str
    sent_at: Optional[datetime] = None  
class AlertCreate(AlertBase):
    pass

class Alert(AlertBase):
    alert_id: int
    timestamp: datetime   

    class Config:
        from_attributes = True 
