from sqlalchemy import Column, Integer, String, Text, Date, UniqueConstraint

from app.core.database import Base


class Experience(Base):
    __tablename__ = "experience"
    __table_args__ = (UniqueConstraint("slug", "locale", name="uq_experience_slug_locale"),)

    id = Column(Integer, primary_key=True)
    slug = Column(String(150), nullable=False)
    locale = Column(String(5), nullable=False)
    organization = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=True)  # NULL = current position
    description = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
