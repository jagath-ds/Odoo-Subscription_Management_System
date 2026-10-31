"""End-to-end smoke test of the core Brightloop workflows against a running API.

Usage (API running, demo data seeded):
    python scripts/backend_smoke_test.py

Environment (falls back to .env / defaults):
    SMOKE_BASE_URL   default http://<API_HOST>:<API_PORT>
    DEMO_ADMIN_EMAIL, DEMO_STAFF_EMAIL, DEMO_PASSWORD

Creates a new customer, quotation, invoices and payments each run.
"""

import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
BASE = os.getenv("SMOKE_BASE_URL") or f"http://{os.getenv('API_HOST', '127.0.0.1')}:{os.getenv('API_PORT', '8000')}"
PASSWORD = os.getenv("DEMO_PASSWORD", "Brightloop@123")
client = httpx.Client(base_url=BASE, timeout=20)
failures = 0


def check(label: str, condition: bool, detail: object = "") -> None:
    global failures
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}" + (f" -> {detail}" if not condition else ""))
    failures += 0 if condition else 1


def call(method: str, path: str, token: str | None = None, expected: int = 200, **kwargs):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = client.request(method, path, headers=headers, **kwargs)
    check(f"{method} {path} -> {expected}", response.status_code == expected, f"{response.status_code} {response.text[:300]}")
    return response.json() if response.content and "json" in response.headers.get("content-type", "") else None


def login(email: str) -> str:
    return call("POST", "/api/auth/login", json={"email": email, "password": PASSWORD})["access_token"]


print(f"Brightloop smoke test against {BASE}")
call("GET", "/api/health")

print("\n1. Sign-up rules")
email = f"smoke-{uuid.uuid4().hex[:6]}@example.com"
call("POST", "/api/auth/signup", expected=400, json={"email": email, "password": "Short@1a", "full_name": "Too Short"})
signup = call("POST", "/api/auth/signup", expected=201, json={"email": email, "password": PASSWORD, "full_name": "Smoke Test Co"})
check("signup creates a CUSTOMER", signup["user"]["role"] == "CUSTOMER")
call("POST", "/api/auth/signup", expected=409, json={"email": email.upper(), "password": PASSWORD, "full_name": "Dup"})
call("POST", "/api/auth/forgot-password", json={"email": email})
customer_token, customer_id = signup["access_token"], signup["user"]["id"]
call("POST", "/api/team/staff", customer_token, expected=403, json={"email": "x@y.z", "password": PASSWORD, "full_name": "Nope", "role": "STAFF"})

admin = login(os.getenv("DEMO_ADMIN_EMAIL", "admin@brightloop.local"))
staff = login(os.getenv("DEMO_STAFF_EMAIL", "staff@brightloop.local"))
call("POST", "/api/products", staff, expected=403, json={"name": "x", "product_type": "SERVICE", "sales_price": 1, "cost_price": 1})

print("\n2. Catalog (+560 variant, GST, discount)")
products = call("GET", "/api/products", admin)
erp = next(p for p in products if p["name"] == "Brightloop Cloud ERP")
odoo = next(v for v in erp["variants"] if v["attribute_value"] == "Odoo")
check("Odoo variant adds 560", odoo["price_extra"] == 560)
templates = call("GET", "/api/quotation-templates", staff)
template = next(t for t in templates if t["name"] == "Enterprise Annual Offer")

print("\n3. Quotation from template -> lifecycle")
start = date.today().isoformat()
sub = call("POST", "/api/subscriptions/from-template", staff, expected=201,
           json={"template_id": template["id"], "customer_id": customer_id, "start_date": start})
check("starts as DRAFT", sub["status"] == "DRAFT")
check("unit price = 2000 + 560", sub["lines"][0]["unit_price"] == 2560)
erp_line = sub["lines"][0]
check("10% bulk discount applied (qty 10)", erp_line["discount_applied"] and erp_line["discount_amount"] == 2560.0)
check("18% GST on discounted amount", erp_line["tax_amount"] == round(23040 * 0.18, 2))
sid = sub["id"]
call("POST", f"/api/subscriptions/{sid}/transition", staff, expected=409, json={"target_status": "ACTIVE"})
for target in ("QUOTATION", "CONFIRMED", "ACTIVE"):
    sub = call("POST", f"/api/subscriptions/{sid}/transition", staff, json={"target_status": target})
check("now ACTIVE", sub["status"] == "ACTIVE")
call("POST", f"/api/subscriptions/{sid}/transition", customer_token, expected=409, json={"target_status": "CLOSED"})
call("GET", f"/api/subscriptions/{sid}", customer_token)

print("\n4. Billing day (idempotent)")
run1 = call("POST", "/api/billing/batch", staff, json={"today": start})
mine = [d for d in run1["decisions"] if d["sub_number"] == sub["sub_number"]]
check("subscription billed once", len(mine) == 1 and mine[0]["action"] == "BILL", mine)
run2 = call("POST", "/api/billing/batch", staff, json={"today": start})
check("second run bills nothing for it", not any(d["sub_number"] == sub["sub_number"] and d["action"] == "BILL" for d in run2["decisions"]))
invoices = call("GET", f"/api/invoices?subscription_id={sid}", staff)
check("exactly one invoice", len(invoices) == 1, invoices)
inv = call("GET", f"/api/invoices/{invoices[0]['id']}", customer_token)
check("invoice DRAFT with snapshot lines", inv["status"] == "DRAFT" and len(inv["lines"]) == 2)
inv = call("POST", f"/api/invoices/{inv['id']}/confirm", staff)

print("\n5. Payments (partial -> paid)")
half = round(inv["grand_total"] / 2, 2)
inv = call("POST", "/api/payments", staff, expected=201,
           json={"invoice_id": inv["id"], "payment_method": "UPI", "amount": half, "payment_date": start, "note": "part 1"})
check("PARTIALLY_PAID", inv["status"] == "PARTIALLY_PAID")
call("POST", "/api/payments", staff, expected=400,
     json={"invoice_id": inv["id"], "payment_method": "CASH", "amount": inv["amount_due"] + 1, "payment_date": start})
inv = call("POST", "/api/payments", staff, expected=201,
           json={"invoice_id": inv["id"], "payment_method": "BANK_TRANSFER", "amount": inv["amount_due"], "payment_date": start, "note": "balance"})
check("PAID with amount_due 0", inv["status"] == "PAID" and inv["amount_due"] == 0)

print("\n6. Pause / resume / add-on toggle")
sub = call("POST", f"/api/subscriptions/{sid}/transition", customer_token, json={"target_status": "PAUSED"})
check("PAUSED", sub["status"] == "PAUSED" and sub["paused_at"] == start)
sub = call("POST", f"/api/subscriptions/{sid}/transition", customer_token, json={"target_status": "ACTIVE"})
check("resumed ACTIVE", sub["status"] == "ACTIVE")
whatsapp = next(p for p in products if p["name"] == "WhatsApp Automated Alerts")
sub = call("POST", f"/api/subscriptions/{sid}/toggle-addon", customer_token,
           json={"product_id": whatsapp["id"], "variant_id": None, "enabled": False})
check("add-on removed", len(sub["lines"]) == 1)

print("\n7. Finance summary")
future = (date.today() + timedelta(days=400)).isoformat()
summary = call("GET", f"/api/analytics/summary?today={future}", admin)
check("summary has KPIs", summary["active_subscriptions_count"] >= 1 and "overdue_invoices" in summary)
check("query under 2 s", summary["query_time_ms"] < 2000, summary["query_time_ms"])
call("GET", "/api/analytics/summary", customer_token, expected=403)

print(f"\n{'ALL CHECKS PASSED' if not failures else f'{failures} CHECK(S) FAILED'}")
sys.exit(1 if failures else 0)
