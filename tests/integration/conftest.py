"""Live-PostgreSQL integration tests for the BrightLoop API.

A throwaway database (default ``brightloop_test``; override with TEST_DATABASE_NAME)
is created on the PostgreSQL server named in DATABASE_URL (.env), seeded with the
demo data, and dropped/recreated at the start of every run. The demo database in
DATABASE_URL is never modified. Tests are skipped when PostgreSQL is unreachable.

Run:  python -m pytest tests/integration -v
"""

import os
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[2]
_DOTENV = dotenv_values(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name) or _DOTENV.get(name) or default


TEST_DB = os.getenv("TEST_DATABASE_NAME", "brightloop_test")
ADMIN_EMAIL = _env("DEMO_ADMIN_EMAIL", "admin@brightloop.local")
STAFF_EMAIL = _env("DEMO_STAFF_EMAIL", "staff@brightloop.local")
CUSTOMER_EMAIL = _env("DEMO_CUSTOMER_EMAIL", "customer@brightloop.local")
PASSWORD = _env("DEMO_PASSWORD", "Brightloop@123")

# Point the application at the test database BEFORE any backend module is imported.
_SKIP_REASON = None
try:
    _url = make_url(_env("DATABASE_URL"))
    if not _url.drivername.startswith("postgresql"):
        _SKIP_REASON = "DATABASE_URL is not a PostgreSQL URL"
    elif _url.database == TEST_DB:
        _SKIP_REASON = "TEST_DATABASE_NAME must differ from the main database"
    else:
        os.environ["DATABASE_URL"] = _url.set(database=TEST_DB).render_as_string(hide_password=False)
except Exception as exc:  # noqa: BLE001
    _SKIP_REASON = f"DATABASE_URL is missing or invalid ({exc})"


@pytest.fixture(scope="session")
def client():
    if _SKIP_REASON:
        pytest.skip(_SKIP_REASON)
    url = make_url(os.environ["DATABASE_URL"])
    try:
        admin = create_engine(url.set(drivername="postgresql+psycopg", database="postgres"), isolation_level="AUTOCOMMIT")
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)'))
            conn.execute(text(f'CREATE DATABASE "{TEST_DB}"'))
        admin.dispose()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"PostgreSQL is not reachable: {exc}")

    from fastapi.testclient import TestClient

    from backend.core.database import Base, engine
    from backend.main import app
    from backend.seed import seed

    assert engine.url.database == TEST_DB, "refusing to run integration tests against a non-test database"
    Base.metadata.create_all(bind=engine)
    seed()
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()


@pytest.fixture
def db(client):
    """A SQLAlchemy session on the test database (used to simulate the passage of time)."""
    from backend.core.database import SessionLocal

    session = SessionLocal()
    yield session
    session.close()


class Api:
    """Small helper around the TestClient with logged-in role headers and builders."""

    def __init__(self, test_client):
        self.c = test_client
        self.password = PASSWORD
        self.admin_email = ADMIN_EMAIL
        self._tokens: dict[str, str] = {}
        self._catalog = None

    # --- auth ---------------------------------------------------------------
    def login(self, email, password=PASSWORD):
        return self.c.post("/api/auth/login", json={"email": email, "password": password})

    def headers_for(self, email, password=PASSWORD):
        if email not in self._tokens:
            response = self.login(email, password)
            assert response.status_code == 200, response.text
            self._tokens[email] = response.json()["access_token"]
        return {"Authorization": f"Bearer {self._tokens[email]}"}

    @property
    def admin(self):
        return self.headers_for(ADMIN_EMAIL)

    @property
    def staff(self):
        return self.headers_for(STAFF_EMAIL)

    @property
    def customer(self):
        return self.headers_for(CUSTOMER_EMAIL)

    def new_customer(self, name="Test Customer"):
        email = f"cust-{uuid4().hex[:10]}@example.com"
        response = self.c.post("/api/auth/signup", json={"email": email, "password": PASSWORD, "full_name": name})
        assert response.status_code == 201, response.text
        body = response.json()
        return SimpleNamespace(id=body["user"]["id"], email=email,
                               headers={"Authorization": f"Bearer {body['access_token']}"})

    # --- seeded catalog -------------------------------------------------------
    @property
    def catalog(self):
        if self._catalog is None:
            products = self.c.get("/api/products", headers=self.admin).json()
            plans = {p["name"]: p for p in self.c.get("/api/plans", headers=self.admin).json()}
            templates = self.c.get("/api/quotation-templates", headers=self.admin).json()
            erp = next(p for p in products if p["name"] == "Brightloop Cloud ERP")
            self._catalog = SimpleNamespace(
                erp=erp,
                odoo=next(v for v in erp["variants"] if v["attribute_value"] == "Odoo"),
                whatsapp=next(p for p in products if p["name"] == "WhatsApp Automated Alerts"),
                monthly=plans["Monthly Starter Plan"],
                annual=plans["Annual Enterprise Plan"],
                template=next(t for t in templates if t["name"] == "Enterprise Annual Offer"),
            )
        return self._catalog

    # --- subscriptions ----------------------------------------------------------
    def transition(self, sub_id, target, headers=None):
        return self.c.post(f"/api/subscriptions/{sub_id}/transition", headers=headers or self.staff,
                           json={"target_status": target})

    def advance(self, sub_id, *targets, headers=None):
        body = None
        for target in targets:
            response = self.transition(sub_id, target, headers)
            assert response.status_code == 200, f"{target}: {response.status_code} {response.text}"
            body = response.json()
        return body

    def quote_from_template(self, customer_id):
        response = self.c.post("/api/subscriptions/from-template", headers=self.staff, json={
            "template_id": self.catalog.template["id"], "customer_id": customer_id,
            "start_date": date.today().isoformat()})
        assert response.status_code == 201, response.text
        return response.json()

    def draft(self, customer_id, plan, lines):
        response = self.c.post("/api/subscriptions", headers=self.staff, json={
            "customer_id": customer_id, "plan_id": plan["id"], "start_date": date.today().isoformat(), "lines": lines})
        assert response.status_code == 201, response.text
        return response.json()

    def active_from_template(self, customer_id):
        quote = self.quote_from_template(customer_id)
        return self.advance(quote["id"], "CONFIRMED", "ACTIVE")

    def active_monthly(self, customer_id, quantity=1, plan=None):
        lines = [{"product_id": self.catalog.erp["id"], "variant_id": self.catalog.odoo["id"], "quantity": quantity}]
        sub = self.draft(customer_id, plan or self.catalog.monthly, lines)
        return self.advance(sub["id"], "QUOTATION", "CONFIRMED", "ACTIVE")

    def invoice(self, sub_id):
        """Manually create a DRAFT invoice for the subscription's current period."""
        response = self.c.post(f"/api/subscriptions/{sub_id}/invoice", headers=self.staff)
        assert response.status_code == 201, response.text
        return response.json()


@pytest.fixture(scope="session")
def api(client):
    return Api(client)
