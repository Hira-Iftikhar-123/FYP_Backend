from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    fcm_token = Column(String, nullable=True)

    alerts = relationship("Alert", back_populates="recipient", cascade="all, delete-orphan")


class Camera(Base):
    __tablename__ = "cameras"

    camera_id = Column(Integer, primary_key=True, index=True)
    location = Column(String, nullable=False)
    stream_url = Column(String, nullable=False)
    status = Column(String, default="active", nullable=False)

    alerts = relationship("Alert", back_populates="camera", cascade="all, delete-orphan")


class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.camera_id"), nullable=False)
    sent_to = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    event_type = Column(String, nullable=False)  # theft, violence, manual_report
    confidence_score = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default="pending", nullable=False)

    camera = relationship("Camera", back_populates="alerts")
    recipient = relationship("User", back_populates="alerts")
    media_items = relationship(
        "EventMedia",
        back_populates="alert",
        cascade="all, delete-orphan",
    )


class EventMedia(Base):
    __tablename__ = "event_media"

    media_id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.alert_id"), nullable=False)
    media_url = Column(String, nullable=False)  # Cloud storage URL
    media_type = Column(String, nullable=False)  # image / video

    alert = relationship("Alert", back_populates="media_items")