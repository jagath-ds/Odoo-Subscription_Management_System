"""Sign-up, login, password policy, password reset and admin-only staff creation."""

from uuid import uuid4

import pytest


def _email():
    return f"auth-{uuid4().hex[:10]}@example.com"


def _signup(api, email, password, **extra):
    return api.c.post("/api/auth/signup", json={"email": email, "password": password, "full_name": "Auth Test", **extra})


@pytest.mark.parametrize("password, rule", [
    ("Short@1a", "exactly 8 characters is not MORE than 8"),
    ("lowercase@123", "no uppercase letter"),
    ("UPPERCASE@123", "no lowercase letter"),
    ("NoSpecial1234", "no special character"),
])
def test_signup_rejects_weak_passwords(api, password, rule):
    response = _signup(api, _email(), password)
    assert response.status_code == 400, rule
    assert "more than 8 characters" in response.json()["detail"]


def test_signup_accepts_a_compliant_password_and_always_creates_a_customer(api):
    response = _signup(api, _email(), "Abcdefg@1", role="ADMIN")  # 9 chars; role must be ignored
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "CUSTOMER"
    assert response.json()["access_token"]


def test_each_email_belongs_to_only_one_account(api):
    email = _email()
    assert _signup(api, email, api.password).status_code == 201
    assert _signup(api, email.upper(), api.password).status_code == 409


def test_login_accepts_only_correct_credentials(api):
    assert api.login(api.admin_email).status_code == 200
    assert api.login(api.admin_email, "Wrong@Password1").status_code == 401
    assert api.login("nobody@example.com").status_code == 401


def test_protected_routes_need_a_valid_token(api):
    assert api.c.get("/api/auth/me").status_code == 401
    assert api.c.get("/api/auth/me", headers={"Authorization": "Bearer forged.token.value"}).status_code == 401
    me = api.c.get("/api/auth/me", headers=api.staff)
    assert me.status_code == 200 and me.json()["role"] == "STAFF"


def test_password_reset_link_is_single_use_and_enforces_the_policy(api, db):
    from backend.core.models import User

    email = _email()
    assert _signup(api, email, api.password).status_code == 201
    response = api.c.post("/api/auth/forgot-password", json={"email": email})
    assert response.status_code == 200 and response.json()["sent"] is True
    token = db.query(User).filter_by(email=email).one().reset_token
    assert token, "a reset token is stored for the registered email"

    def reset(new_password):
        return api.c.post("/api/auth/reset-password", json={"token": token, "new_password": new_password})

    assert reset("weakpass1").status_code == 400
    assert reset("NewPass#2026").status_code == 200
    assert reset("Another#2027").status_code == 400  # the link cannot be reused
    assert api.login(email, api.password).status_code == 401
    assert api.login(email, "NewPass#2026").status_code == 200


def test_forgot_password_does_not_reveal_which_emails_exist(api):
    response = api.c.post("/api/auth/forgot-password", json={"email": "unknown-person@example.com"})
    assert response.status_code == 200
    assert response.json() == {"sent": True, "email": "unknown-person@example.com"}


def test_reset_rejects_a_forged_token(api):
    response = api.c.post("/api/auth/reset-password", json={"token": "forged-token-value", "new_password": "NewPass#2026"})
    assert response.status_code == 400


def test_only_the_admin_can_add_staff(api):
    def payload():
        return {"email": _email(), "password": api.password, "full_name": "New Staff", "role": "STAFF"}

    assert api.c.post("/api/team/staff", headers=api.staff, json=payload()).status_code == 403
    assert api.c.post("/api/team/staff", headers=api.customer, json=payload()).status_code == 403
    member = payload()
    created = api.c.post("/api/team/staff", headers=api.admin, json=member)
    assert created.status_code == 201 and created.json()["role"] == "STAFF"
    assert api.login(member["email"]).status_code == 200
    team = api.c.get("/api/team/staff", headers=api.admin).json()
    assert any(user["email"] == member["email"] for user in team)


def test_staff_creation_validates_role_and_password(api):
    base = {"email": _email(), "full_name": "Invalid Staff"}
    assert api.c.post("/api/team/staff", headers=api.admin, json={**base, "password": api.password, "role": "CUSTOMER"}).status_code == 400
    assert api.c.post("/api/team/staff", headers=api.admin, json={**base, "password": "weak", "role": "STAFF"}).status_code == 400
