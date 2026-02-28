"""
EcoSphere Neural — Authentication Module
==========================================
Password hashing, JWT token creation, and FastAPI
dependency for extracting the current user from a
Bearer token.
"""

from datetime import datetime, timedelta, timezone
import os

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "ecosphere-dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# ---------------------------------------------------------------------------
# Password hashing (using bcrypt directly for Python 3.14 compatibility)
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash a plain-text password."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

def create_access_token(data: dict) -> str:
    """
    Create a signed JWT with an expiration claim.

    Args:
        data: payload dict — typically {"sub": user_email}
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    """
    Decode a JWT and return the subject (email).
    Raises HTTPException 401 on failure.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise JWTError("Missing subject")
        return email
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    Dependency that extracts the authenticated user from the
    Authorization: Bearer <token> header.
    """
    from models import User  # deferred import to avoid circular dependency

    email = verify_token(token)
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
