"""
SQLAlchemy engine and session setup. Import `get_db` as a FastAPI dependency
in routers that need database access.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

engine = create_engine(settings.sqlalchemy_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class every model inherits from (see app/models/)
Base = declarative_base()


def get_db() -> Generator:
    """FastAPI dependency: yields a DB session, always closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
