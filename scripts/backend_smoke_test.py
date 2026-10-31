"""Read-only smoke test for a running BrightLoop backend.

Run with the API already started:
    python scripts/backend_smoke_test.py

Override credentials when needed:
    $env:SMOKE_EMAIL = "admin@example.com"
    $env:SMOKE_PASSWORD = "YourPassword"
"""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_URL = os.getenv("SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
EMAIL = os.getenv("SMOKE_EMAIL", "demo1@gmail.com")
PASSWORD = os.getenv("SMOKE_PASSWORD", "Pass@123")
ROLE = os.getenv("SMOKE_ROLE", "CUSTOMER").upper()


def request(method: str, path: str, token: str | None = None, form: dict | None = None):
    headers = {"Accept": "application/json"}
    body = None
    if form is not None:
        body = urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    with urlopen(req, timeout=10) as response:
        raw = response.read().decode()
        return response.status, json.loads(raw) if raw else None


def check(label: str, method: str, path: str, token: str | None = None, form: dict | None = None, expected: int = 200):
    try:
        status, data = request(method, path, token=token, form=form)
    except HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        if exc.code == expected:
            print(f"PASS {label}: HTTP {exc.code} (expected)")
            return {"status_code": exc.code, "detail": detail}
        print(f"FAIL {label}: HTTP {exc.code} {detail}")
        return None
    except (URLError, TimeoutError, OSError) as exc:
        print(f"FAIL {label}: backend is unreachable ({exc})")
        return None
    if status != expected:
        print(f"FAIL {label}: HTTP {status}, expected {expected}")
        return None
    print(f"PASS {label}: HTTP {status}")
    return data


def main() -> int:
    failures = 0
    if check("health", "GET", "/api/health") is None:
        return 1

    login = check(
        f"{ROLE.lower()} login",
        "POST",
        "/api/auth/login",
        form={"username": EMAIL, "password": PASSWORD},
    )
    if not login or not login.get("access_token"):
        return 1
    token = login["access_token"]

    current = check("current user", "GET", "/api/auth/me", token)
    if current is None:
        failures += 1
    elif current.get("role") != ROLE:
        print(f"FAIL current user: expected role {ROLE}, got {current.get('role')}")
        failures += 1

    paths = [
        ("products endpoint", "/api/catalog/products"),
        ("plans endpoint", "/api/catalog/plans"),
        ("tax rules endpoint", "/api/catalog/taxes"),
        ("discount rules endpoint", "/api/catalog/discounts"),
        ("quotation templates endpoint", "/api/catalog/templates"),
        ("subscriptions endpoint", "/api/subscriptions"),
        ("invoices endpoint", "/api/invoices"),
    ]
    for label, path in paths:
        expected = 403 if ROLE == "CUSTOMER" and label in {"discount rules endpoint", "quotation templates endpoint"} else 200
        if check(label, "GET", path, token, expected=expected) is None:
            failures += 1

    overdue_expected = 403 if ROLE == "CUSTOMER" else 200
    if check("overdue summary endpoint", "GET", "/api/invoices/summary/overdue", token, expected=overdue_expected) is None:
        failures += 1

    if failures:
        print(f"\nSmoke test failed: {failures} check(s) failed.")
        return 1
    print("\nSmoke test passed: backend is reachable and core read/auth endpoints are working.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
