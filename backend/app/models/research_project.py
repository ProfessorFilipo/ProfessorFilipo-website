from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class ResearchProject(Base):
    __tablename__ = "research_projects"
    __table_args__ = (UniqueConstraint("slug", "locale", name="uq_research_projects_slug_locale"),)

    id = Column(Integer, primary_key=True)
    slug = Column(String(150), nullable=False)
    locale = Column(String(5), nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    # updated_at is kept fresh by the DB trigger (set_updated_at), not by the app
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
