"""Quotations, pricing, the status pipeline, quotation expiry, plan permissions, pause/resume and add-ons."""

from datetime import date, timedelta
from uuid import uuid4

import pytest

ERP, ADDON = "Brightloop Cloud ERP", "WhatsApp Automated Alerts"


def _line(sub, product_name):
    return next(line for line in sub["lines"] if line["product_name"] == product_name)


# quotations & pricing
def test_template_quote_prefills_plan_lines_variant_discount_and_tax(api):
    quote = api.quote_from_template(api.new_customer().id)
    assert quote["status"] == "DRAFT" and quote["plan_name"] == "Annual Enterprise Plan"
    assert quote["sub_number"].startswith("SUB-")
    erp = _line(quote, ERP)
    assert erp["variant_name"] == "Brand: Odoo" and erp["quantity"] == 10
    assert erp["unit_price"] == 2560                                    # 2,000 base + 560 Odoo brand
    assert erp["discount_applied"] and erp["discount_amount"] == pytest.approx(2560)  # 10% for >= 10 seats
    assert erp["tax_percent"] == 18 and erp["tax_amount"] == pytest.approx(4147.20)  # GST on the discounted amount
    assert erp["line_total"] == pytest.approx(27187.20)
    addon = _line(quote, ADDON)
    assert addon["discount_applied"] is False and addon["line_total"] == pytest.approx(354.00)
    assert quote["summary"] == pytest.approx({
        "subtotal": 25900.0, "line_discount_total": 2560.0, "subscription_discount": 0.0,
        "total_discount": 2560.0, "total_tax": 4201.2, "grand_total": 27541.2})


def test_discount_needs_its_minimum_quantity(api):
    sub = api.active_monthly(api.new_customer().id, quantity=9)
    erp = _line(sub, ERP)
    assert erp["discount_applied"] is False and erp["discount_amount"] == 0
    assert sub["summary"]["grand_total"] == pytest.approx(9 * 2560 * 1.18)


def test_expired_and_not_yet_valid_discounts_are_ignored(api):
    today = date.today()
    for name, start, end, value in [("Expired 50%", today - timedelta(days=30), today - timedelta(days=1), 50),
                                    ("Future 40%", today + timedelta(days=1), today + timedelta(days=30), 40)]:
        created = api.c.post("/api/discount-rules", headers=api.admin, json={
            "name": f"{name} {uuid4().hex[:4]}", "discount_type": "PERCENT", "value": value, "scope": "PRODUCT",
            "min_qty": 0, "valid_from": start.isoformat(), "valid_until": end.isoformat()})
        assert created.status_code == 201
    sub = api.active_monthly(api.new_customer().id, quantity=9)
    assert sub["summary"]["total_discount"] == 0


def test_plan_minimum_quantity_is_enforced(api):
    customer = api.new_customer()
    response = api.c.post("/api/subscriptions", headers=api.staff, json={
        "customer_id": customer.id, "plan_id": api.catalog.annual["id"], "start_date": date.today().isoformat(),
        "lines": [{"product_id": api.catalog.erp["id"], "quantity": 2}]})
    assert response.status_code == 400 and "minimum quantity of 5" in response.json()["detail"]


# status pipeline
def test_pipeline_runs_draft_quotation_confirmed_active(api):
    customer = api.new_customer()
    sub = api.draft(customer.id, api.catalog.monthly, [{"product_id": api.catalog.erp["id"], "quantity": 1}])
    assert sub["status"] == "DRAFT"
    for target in ["QUOTATION", "CONFIRMED", "ACTIVE"]:
        response = api.transition(sub["id"], target)
        assert response.status_code == 200 and response.json()["status"] == target


def test_pipeline_cannot_skip_steps(api):
    customer = api.new_customer()
    sub = api.draft(customer.id, api.catalog.monthly, [{"product_id": api.catalog.erp["id"], "quantity": 1}])
    assert api.transition(sub["id"], "CONFIRMED").status_code == 409  # DRAFT -> CONFIRMED skips QUOTATION
    assert api.transition(sub["id"], "ACTIVE").status_code == 409
    api.advance(sub["id"], "QUOTATION")
    assert api.transition(sub["id"], "ACTIVE").status_code == 409     # QUOTATION -> ACTIVE skips CONFIRMED
    api.advance(sub["id"], "CONFIRMED")
    assert api.transition(sub["id"], "PAUSED").status_code == 409     # only ACTIVE subscriptions can pause


def test_customers_cannot_move_a_quotation(api):
    customer = api.new_customer()
    quote = api.quote_from_template(customer.id)
    assert api.transition(quote["id"], "CONFIRMED", headers=customer.headers).status_code == 403


# quotation validity
def test_template_validity_sets_the_quotation_deadline(api):
    quote = api.quote_from_template(api.new_customer().id)
    expected = date.today() + timedelta(days=api.catalog.template["validity_days"])
    assert quote["quotation_valid_until"] == expected.isoformat()


def test_expired_quotation_cannot_be_confirmed(api, db):
    from backend.core.models import Subscription

    quote = api.quote_from_template(api.new_customer().id)
    api.advance(quote["id"], "QUOTATION")
    db.get(Subscription, quote["id"]).quotation_valid_until = date.today() - timedelta(days=1)
    db.commit()
    response = api.transition(quote["id"], "CONFIRMED")
    assert response.status_code == 409 and "expired" in response.json()["detail"]
    assert api.c.get(f"/api/subscriptions/{quote['id']}", headers=api.staff).json()["status"] == "QUOTATION"


def test_quotation_can_be_confirmed_on_its_last_valid_day(api, db):
    from backend.core.models import Subscription

    quote = api.quote_from_template(api.new_customer().id)
    db.get(Subscription, quote["id"]).quotation_valid_until = date.today()
    db.commit()
    assert api.advance(quote["id"], "QUOTATION", "CONFIRMED")["status"] == "CONFIRMED"


# plan permissions, pause / resume, close / renew
def test_pause_and_resume_shift_billing_and_expiry_by_the_paused_days(api, db):
    from backend.core.models import Subscription

    customer = api.new_customer()
    sub = api.active_monthly(customer.id)
    billing_before = date.fromisoformat(sub["next_billing_date"])
    expiry_before = date.fromisoformat(sub["expiry_date"])

    paused = api.advance(sub["id"], "PAUSED", headers=customer.headers)
    assert paused["status"] == "PAUSED" and paused["paused_at"] == date.today().isoformat()
    db.get(Subscription, sub["id"]).paused_at = date.today() - timedelta(days=12)  # simulate a 12-day pause
    db.commit()

    resumed = api.advance(sub["id"], "ACTIVE", headers=customer.headers)
    assert resumed["status"] == "ACTIVE" and resumed["paused_at"] is None
    assert resumed["next_billing_date"] == (billing_before + timedelta(days=12)).isoformat()
    assert resumed["expiry_date"] == (expiry_before + timedelta(days=12)).isoformat()


def test_plan_flags_block_pause_and_renew(api):
    plan = api.c.post("/api/plans", headers=api.admin, json={
        "name": f"Locked Weekly {uuid4().hex[:4]}", "billing_frequency": "WEEKLY", "plan_price": 500, "min_qty": 1,
        "auto_close": False, "can_close_early": True, "can_pause": False, "can_renew": False}).json()
    sub = api.active_monthly(api.new_customer().id, plan=plan)
    paused = api.transition(sub["id"], "PAUSED")
    assert paused.status_code == 409 and "paus" in paused.json()["detail"].lower()
    assert api.advance(sub["id"], "CLOSED")["status"] == "CLOSED"     # early close is allowed on this plan
    assert api.transition(sub["id"], "ACTIVE").status_code == 409     # renewal is not


def test_annual_plan_cannot_be_closed_before_expiry(api):
    sub = api.active_from_template(api.new_customer().id)
    response = api.transition(sub["id"], "CLOSED")
    assert response.status_code == 409 and "before its expiry" in response.json()["detail"]


def test_customer_can_close_and_renew_when_the_plan_allows(api):
    customer = api.new_customer()
    sub = api.active_monthly(customer.id)
    assert api.advance(sub["id"], "CLOSED", headers=customer.headers)["status"] == "CLOSED"
    renewed = api.advance(sub["id"], "ACTIVE", headers=customer.headers)
    assert renewed["status"] == "ACTIVE" and renewed["next_billing_date"] == date.today().isoformat()


# add-ons
def test_customer_switches_addons_on_and_off(api):
    customer = api.new_customer()
    sub = api.active_monthly(customer.id)  # 1 x Cloud ERP (Odoo)
    base_total = sub["summary"]["grand_total"]
    url = f"/api/subscriptions/{sub['id']}/toggle-addon"

    def toggle(enabled):
        return api.c.post(url, headers=customer.headers,
                          json={"product_id": api.catalog.whatsapp["id"], "variant_id": None, "enabled": enabled})

    on = toggle(True)
    assert on.status_code == 200
    assert [l["product_name"] for l in on.json()["lines"]].count(ADDON) == 1
    assert on.json()["summary"]["grand_total"] == pytest.approx(base_total + 354.0)  # 300 + 18% GST
    assert [l["product_name"] for l in toggle(True).json()["lines"]].count(ADDON) == 1  # no duplicates
    off = toggle(False).json()
    assert ADDON not in [l["product_name"] for l in off["lines"]]
    assert off["summary"]["grand_total"] == pytest.approx(base_total)


def test_addon_toggle_guards(api):
    owner, stranger = api.new_customer(), api.new_customer()
    sub = api.active_monthly(owner.id)
    url = f"/api/subscriptions/{sub['id']}/toggle-addon"
    addon = {"product_id": api.catalog.whatsapp["id"], "variant_id": None, "enabled": True}
    service = {"product_id": api.catalog.erp["id"], "variant_id": None, "enabled": True}
    assert api.c.post(url, headers=owner.headers, json=service).status_code == 400    # only ADDON products
    assert api.c.post(url, headers=stranger.headers, json=addon).status_code == 403   # not their subscription
    api.advance(sub["id"], "CLOSED", headers=owner.headers)
    assert api.c.post(url, headers=owner.headers, json=addon).status_code == 409      # closed subscriptions are frozen
