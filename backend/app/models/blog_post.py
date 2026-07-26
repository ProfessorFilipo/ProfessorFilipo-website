from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

# Association table (no model needed, it's just a join table)
blog_post_tags = Table(
    "blog_post_tags",
    Base.metadata,
    Column("post_id", Integer, ForeignKey("blog_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class BlogPost(Base):
    __tablename__ = "blog_posts"
    __table_args__ = (UniqueConstraint("slug", "locale", name="uq_blog_posts_slug_locale"),)

    id = Column(Integer, primary_key=True)
    slug = Column(String(255), nullable=False)
    locale = Column(String(5), nullable=False)  # this specific post's language
    title = Column(String(255), nullable=False)
    excerpt = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)  # Markdown + video shortcodes
    cover_image_id = Column(Integer, ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # 'draft' or 'published'
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # updated_at is kept fresh by the DB trigger (set_updated_at), not by the app
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    tags = relationship("Tag", secondary=blog_post_tags, backref="posts")
