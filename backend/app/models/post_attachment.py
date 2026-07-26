from sqlalchemy import Column, Integer, String, ForeignKey

from app.core.database import Base


class PostAttachment(Base):
    __tablename__ = "post_attachments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(255), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
