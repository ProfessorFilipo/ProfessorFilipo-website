from sqlalchemy import Column, String, Text

from app.core.database import Base


class Setting(Base):
    __tablename__ = "settings"

    setting_key = Column(String(100), primary_key=True)
    setting_value = Column(Text, nullable=True)
