from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class Page(Base):
    __tablename__ = "pages"
    __table_args__ = (UniqueConstraint("slug", "locale", name="uq_pages_slug_locale"),)

    id = Column(Integer, primary_key=True)
    slug = Column(String(100), nullable=False)
    locale = Column(String(5), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # Markdown
    meta_description = Column(String(320), nullable=True)
    # updated_at is kept fresh by the DB trigger (set_updated_at), not by the app
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
