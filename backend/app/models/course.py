from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    institution = Column(String(255), nullable=False)
    term = Column(String(20), nullable=False)  # e.g. "2026/1"
    description = Column(Text, nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
