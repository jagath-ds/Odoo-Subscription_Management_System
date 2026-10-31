"""JWT authentication, password policy, and role guards."""

import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET_KEY
from .database import get_db
from .models import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Swagger's "Authorize" button posts an OAuth2 form to /api/auth/token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# Problem statement: MORE than eight characters (9+), with an uppercase letter,
# a lowercase letter and a special character.
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{9,}$")
PASSWORD_RULE_MESSAGE = (
    "Password must be more than 8 characters and include an uppercase letter, "
    "a lowercase letter, and a special character"
)


def validate_password(password: str) -> bool:
    return bool(PASSWORD_REGEX.match(password))


def ensure_valid_password(password: str) -> None:
    if not validate_password(password):
        raise HTTPException(status_code=400, detail=PASSWORD_RULE_MESSAGE)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def new_reset_token() -> str:
    return secrets.token_urlsafe(32)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exception
    user = db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user


def require_role(*roles: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


admin_only = require_role(UserRole.ADMIN)
staff_or_admin = require_role(UserRole.ADMIN, UserRole.STAFF)
