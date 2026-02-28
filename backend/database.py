"""
EcoSphere Neural — Database Configuration
==========================================
SQLAlchemy engine, session factory, and dependency injection
for FastAPI endpoints.

Uses PostgreSQL via psycopg2.
Reads DATABASE_URL from environment variables for production safety.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/ecosphere")

# Render provides URLs starting with "postgres://", but SQLAlchemy requires
# "postgresql://". Auto-fix if needed.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------

def get_db():
    """
    FastAPI dependency that yields a database session.
    Automatically closes the session when the request is done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
