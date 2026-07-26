from sqlalchemy import Column, Integer, String

from app.core.database import Base


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
