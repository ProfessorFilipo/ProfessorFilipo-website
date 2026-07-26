from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False)  # R2 object key/path
    alt_text = Column(String(255), nullable=True)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
