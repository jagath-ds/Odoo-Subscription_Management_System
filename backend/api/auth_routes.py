"""Authentication, password reset, staff team, and customer directory endpoints."""

import logging
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import config
from ..core.auth import (
    admin_only,
    create_access_token,
    ensure_valid_password,
    get_current_user,
    hash_password,
    staff_or_admin,
    verify_password,
)
from ..core.database import get_db
from ..core.models import User, UserRole
from ..core.schemas import (
    CustomerResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    PublicUserCreate,
    ResetPasswordRequest,
    SessionUser,
    TokenResponse,
    UserCreate,
    UserResponse,
)

log = logging.getLogger("brightloop.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])
team_router = APIRouter(prefix="/api", tags=["users"])


def _normalise(email: str) -> str:
    return email.strip().lower()


def _find_user(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == _normalise(email)).first()


def _create_user(db: Session, payload: PublicUserCreate, role: UserRole) -> User:
    ensure_valid_password(payload.password)
    if _find_user(db, payload.email):
        raise HTTPException(status_code=409, detail="Email is already registered")
    user = User(
        email=_normalise(payload.email),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token_for(user: User) -> TokenResponse:
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(access_token=token, user=SessionUser.model_validate(user))


def _authenticate(db: Session, email: str, password: str) -> User:
    user = _find_user(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: PublicUserCreate, db: Session = Depends(get_db)):
    """Public self-service signup. Always creates a CUSTOMER account."""
    return _token_for(_create_user(db, payload, UserRole.CUSTOMER))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return _token_for(_authenticate(db, payload.email, payload.password))


@router.post("/token", response_model=TokenResponse, include_in_schema=True)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 form login used by Swagger's Authorize button (username = email)."""
    return _token_for(_authenticate(db, form_data.username, form_data.password))


@router.get("/me", response_model=UserResponse)
def get_me(current: User = Depends(get_current_user)):
    return current


def _send_reset_email(to: str, link: str) -> None:
    if not config.SMTP_HOST:
        log.warning("Password reset link for %s: %s", to, link)
        print(f"[password-reset] {to} -> {link}", flush=True)
        return
    msg = EmailMessage()
    msg["Subject"] = "Reset your Brightloop password"
    msg["From"] = config.SMTP_FROM
    msg["To"] = to
    msg.set_content(f"Use this link to reset your password (valid {config.RESET_TOKEN_EXPIRE_MINUTES} minutes):\n{link}")
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        if config.SMTP_USER:
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(msg)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send a reset link to the registered email. Always responds the same way
    so the endpoint cannot be used to discover which emails are registered."""
    user = _find_user(db, payload.email)
    if user:
        token = create_access_token(
            {"sub": str(user.id), "purpose": "reset"},
            expires_delta=timedelta(minutes=config.RESET_TOKEN_EXPIRE_MINUTES),
        )
        user.reset_token = token
        db.commit()
        link = f"{config.FRONTEND_URL}/reset-password?token={token}"
        try:
            _send_reset_email(user.email, link)
        except Exception:  # noqa: BLE001 - never leak SMTP failures to the caller
            log.exception("Failed to send reset email; link: %s", link)
    return ForgotPasswordResponse(sent=True, email=payload.email)


@router.post("/reset-password", response_model=SessionUser)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    invalid = HTTPException(status_code=400, detail="Reset link is invalid or has expired")
    try:
        claims = jwt.decode(payload.token, config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        user_id = int(claims["sub"])
    except (JWTError, KeyError, ValueError):
        raise invalid
    user = db.get(User, user_id)
    if not user or claims.get("purpose") != "reset" or user.reset_token != payload.token:
        raise invalid
    ensure_valid_password(payload.new_password)
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None  # single use
    db.commit()
    return user


# Staff team (admin only) and customer directory (staff/admin)
@team_router.get("/team/staff", response_model=list[UserResponse])
def list_staff(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return (
        db.query(User)
        .filter(User.role.in_([UserRole.ADMIN, UserRole.STAFF]))
        .order_by(User.role, User.full_name)
        .all()
    )


@team_router.post("/team/staff", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def add_staff(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    """Only the admin can add a new member of staff."""
    if payload.role == UserRole.CUSTOMER:
        raise HTTPException(status_code=400, detail="Use public signup for customer accounts")
    return _create_user(db, payload, payload.role)


@team_router.get("/customers", response_model=list[CustomerResponse])
def list_customers(db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    customers = db.query(User).filter(User.role == UserRole.CUSTOMER).order_by(User.full_name).all()
    return [
        CustomerResponse(
            id=c.id,
            full_name=c.full_name,
            email=c.email,
            company=c.email.split("@")[-1].split(".")[0].title(),
        )
        for c in customers
    ]
