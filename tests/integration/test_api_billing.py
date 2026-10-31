"""Invoices, payments, snapshots, discount usage limits and the Billing Day batch."""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from dateutil.relativedelta import relativedelta


def _invoices_for(api, sub_id):
    return api.c.get(f"/api/invoices?subscription_id={sub_id}", headers=api.staff).json()


# --- invoices -----------------------------------------------------------------------------------
def test_manual_invoice_starts_as_draft_with_filled_in_snapshot_lines(api):
    sub = api.active_from_template(api.new_customer().id)
    invoice = api.invoice(sub["id"])
    assert invoice["status"] == "DRAFT"
    assert invoice["billing_period_key"] == f"{sub['sub_number']}:{sub['next_billing_date']}"
    assert invoice["grand_total"] == pytest.approx(27541.2)
    assert invoice["total_tax"] == pytest.approx(4201.2) and invoice["total_discount"] == pytest.approx(2560)
    assert invoice["due_date"] == (date.today() + timedelta(days=30)).isoformat()  # payment terms
    erp = next(l for l in invoice["lines"] if l["product_name_snapshot"] == "Brightloop Cloud ERP")
    assert erp["variant_name_snapshot"] == "Brand: Odoo"
    assert erp["unit_price_snapshot"] == 2560 and erp["tax_percent_snapshot"] == 18


def test_invoice_confirm_send_cancel_print_and_remind(api):
    sub = api.active_monthly(api.new_customer().id)
    first = api.invoice(sub["id"])
    url = f"/api/invoices/{first['id']}"
    assert api.c.post(url + "/send", headers=api.staff).json()["status"] == "CONFIRMED"  # sending confirms a draft
    assert api.c.post(url + "/confirm", headers=api.staff).status_code == 409
    printed = api.c.get(url + "/print", headers=api.staff)
    assert printed.status_code == 200 and first["invoice_number"] in printed.text
    assert api.c.post(url + "/remind", headers=api.staff).json()["sent"] is True

    second = api.invoice(sub["id"])  # the next billing period
    assert second["billing_period_key"] != first["billing_period_key"]
    cancelled = api.c.post(f"/api/invoices/{second['id']}/cancel", headers=api.staff).json()
    assert cancelled["status"] == "CANCELLED" and cancelled["amount_due"] == 0
    assert api.c.post(f"/api/invoices/{second['id']}/confirm", headers=api.staff).status_code == 409


def test_invoice_snapshot_survives_catalog_changes(api):
    product = api.c.post("/api/products", headers=api.admin, json={
        "name": f"Snapshot Widget {uuid4().hex[:4]}", "product_type": "SERVICE", "sales_price": 1000, "cost_price": 100}).json()
    customer = api.new_customer()
    sub = api.draft(customer.id, api.catalog.monthly, [{"product_id": product["id"], "quantity": 1}])
    api.advance(sub["id"], "QUOTATION", "CONFIRMED", "ACTIVE")
    invoice = api.invoice(sub["id"])
    edit = api.c.put(f"/api/products/{product['id']}", headers=api.admin, json={"name": "Renamed Widget", "sales_price": 5000})
    assert edit.status_code == 200
    again = api.c.get(f"/api/invoices/{invoice['id']}", headers=api.staff).json()
    assert again["lines"][0]["product_name_snapshot"] == product["name"]
    assert again["lines"][0]["unit_price_snapshot"] == 1000
    assert again["grand_total"] == invoice["grand_total"] == pytest.approx(1180)


def test_discount_stops_once_its_usage_limit_is_reached(api):
    today = date.today()
    rule = api.c.post("/api/discount-rules", headers=api.admin, json={
        "name": f"One-time deal {uuid4().hex[:4]}", "discount_type": "FIXED", "value": 1000, "scope": "SUBSCRIPTION",
        "min_qty": 0, "min_purchase": 100000, "max_uses": 1,
        "valid_from": (today - timedelta(days=1)).isoformat(), "valid_until": (today + timedelta(days=30)).isoformat()}).json()
    sub = api.active_monthly(api.new_customer().id, quantity=50)  # 50 x 2,560 = 128,000 gross
    assert sub["summary"]["subscription_discount"] == 1000

    first = api.invoice(sub["id"])
    assert first["total_discount"] == pytest.approx(12800 + 1000)  # 10% seat discount + the one-time deal
    rules = {r["id"]: r for r in api.c.get("/api/discount-rules", headers=api.admin).json()}
    assert rules[rule["id"]]["current_uses"] == 1
    second = api.invoice(sub["id"])  # next period: the deal has run out
    assert second["total_discount"] == pytest.approx(12800)


# --- payments ---------------------------------------------------------------------------------------
def test_partial_then_full_payment(api):
    customer = api.new_customer()
    sub = api.active_from_template(customer.id)
    invoice = api.invoice(sub["id"])
    today = date.today().isoformat()

    def pay(amount, method="UPI"):
        return api.c.post("/api/payments", headers=api.staff, json={
            "invoice_id": invoice["id"], "payment_method": method, "amount": amount, "payment_date": today, "note": "test"})

    assert pay(100).status_code == 409  # drafts cannot take payments
    confirmed = api.c.post(f"/api/invoices/{invoice['id']}/confirm", headers=api.staff).json()
    assert confirmed["status"] == "CONFIRMED"
    assert pay(confirmed["grand_total"] + 1).status_code == 400  # over-payment

    partial = pay(11016.48)
    assert partial.status_code == 201
    body = partial.json()
    assert body["status"] == "PARTIALLY_PAID"
    assert body["amount_paid"] == pytest.approx(11016.48) and body["amount_due"] == pytest.approx(16524.72)

    full = pay(body["amount_due"], "BANK_TRANSFER").json()
    assert full["status"] == "PAID" and full["amount_due"] == 0 and full["amount_paid"] == pytest.approx(27541.2)
    assert [p["payment_method"] for p in full["payments"]] == ["UPI", "BANK_TRANSFER"]
    assert pay(1).status_code == 409  # nothing left to pay
    assert api.c.post(f"/api/invoices/{invoice['id']}/cancel", headers=api.staff).status_code == 409

    ledger = api.c.get("/api/payments", headers=api.staff).json()
    assert sum(1 for p in ledger if p["invoice_id"] == invoice["id"]) == 2
    assert api.c.get(f"/api/invoices/{invoice['id']}", headers=customer.headers).json()["status"] == "PAID"


# --- Billing Day ---------------------------------------------------------------------------------------
def test_billing_day_bills_each_due_subscription_exactly_once(api):
    sub = api.active_from_template(api.new_customer().id)
    today = date.today().isoformat()
    assert sub["next_billing_date"] == today

    first = api.c.post("/api/billing/batch", headers=api.staff, json={"today": today})
    assert first.status_code == 200 and first.json()["billed"] >= 1
    mine = [d for d in first.json()["decisions"] if d["sub_number"] == sub["sub_number"]]
    assert len(mine) == 1 and mine[0]["action"] == "BILL"
    assert mine[0]["period_key"] == f"{sub['sub_number']}:{today}" and mine[0]["amount"] == pytest.approx(27541.2)
    invoices = _invoices_for(api, sub["id"])
    assert len(invoices) == 1 and invoices[0]["status"] == "CONFIRMED"

    second = api.c.post("/api/billing/batch", headers=api.staff, json={"today": today}).json()
    assert not any(d["sub_number"] == sub["sub_number"] and d["action"] == "BILL" for d in second["decisions"])
    assert len(_invoices_for(api, sub["id"])) == 1
    after = api.c.get(f"/api/subscriptions/{sub['id']}", headers=api.staff).json()
    assert after["next_billing_date"] == (date.today() + relativedelta(years=1)).isoformat()


def test_database_rejects_a_second_invoice_for_the_same_period(api, db):
    from sqlalchemy.exc import IntegrityError

    from backend.core.models import Invoice, InvoiceStatus

    customer = api.new_customer()
    sub = api.active_monthly(customer.id)
    existing = api.invoice(sub["id"])
    db.add(Invoice(
        invoice_number=f"INV-DUP-{uuid4().hex[:6]}", subscription_id=sub["id"], customer_id=customer.id,
        billing_period_key=existing["billing_period_key"], status=InvoiceStatus.DRAFT,
        issue_date=date.today(), due_date=date.today()))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_billing_day_auto_closes_expired_subscriptions_on_auto_close_plans(api, db):
    from backend.core.models import Subscription

    sub = api.active_from_template(api.new_customer().id)  # Annual Enterprise Plan: auto_close = true
    db.get(Subscription, sub["id"]).expiry_date = date.today() - timedelta(days=1)
    db.commit()
    report = api.c.post("/api/billing/batch", headers=api.staff, json={}).json()
    mine = [d for d in report["decisions"] if d["sub_number"] == sub["sub_number"]]
    assert mine and mine[0]["action"] == "AUTO_CLOSE"
    assert api.c.get(f"/api/subscriptions/{sub['id']}", headers=api.staff).json()["status"] == "CLOSED"
    assert _invoices_for(api, sub["id"]) == []  # an expired contract is not billed
