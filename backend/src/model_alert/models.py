from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    REAL,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()



class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(60), nullable=False)
    role = Column(String(50), nullable=False, default="user")
    fcm_token = Column(String(300), nullable=True)

    alerts = relationship(
        "Alert",
        foreign_keys="Alert.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    alerts_sent = relationship(
        "Alert",
        foreign_keys="Alert.sent_to_INT",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )


class Camera(Base):
    __tablename__ = "Cameras"

    camera_id = Column(Integer, primary_key=True, index=True)
    location = Column(String(255), nullable=False)
    stream_url = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False)

    alerts = relationship(
        "Alert",
        back_populates="camera",
        cascade="all, delete-orphan",
    )


class Alert(Base):
    __tablename__ = "Alerts"

    alert_id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(
        Integer,
        ForeignKey("Cameras.camera_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type = Column(String(50), nullable=False)
    confidence_score = Column(REAL, nullable=True)
    timestamp = Column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    method = Column(String(20), nullable=True)
    sent_to_INT = Column(
        Integer,
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    sent_at = Column(DateTime(timezone=False), nullable=True)
    status = Column(String(20), nullable=False)

    camera = relationship("Camera", back_populates="alerts")
    user = relationship("User", foreign_keys=[user_id], back_populates="alerts")
    recipient = relationship("User", foreign_keys=[sent_to_INT], back_populates="alerts_sent")

    media_items = relationship(
        "EventMedia",
        back_populates="alert",
        cascade="all, delete-orphan",
    )


class EventMedia(Base):
    __tablename__ = "EventMedia"

    media_id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(
        Integer,
        ForeignKey("Alerts.alert_id", ondelete="CASCADE"),
        nullable=False,
    )
    media_url = Column(String(500), nullable=False)
    media_type = Column(String(50), nullable=False)

    alert = relationship("Alert", back_populates="media_items")
