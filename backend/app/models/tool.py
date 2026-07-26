from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class Tool(Base):
    __tablename__ = "tools"
    __table_args__ = (UniqueConstraint("slug", "locale", name="uq_tools_slug_locale"),)

    id = Column(Integer, primary_key=True)
    slug = Column(String(150), nullable=False)
    locale = Column(String(5), nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(String(500), nullable=True)
    documentation = Column(Text, nullable=True)  # Markdown (usage docs)
    repo_url = Column(String(500), nullable=True)
    demo_url = Column(String(500), nullable=True)
    tech_stack = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    # updated_at is kept fresh by the DB trigger (set_updated_at), not by the app
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
