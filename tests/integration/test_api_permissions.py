"""Role-based access: admin controls the catalog, staff run operations, customers see only their own data."""

from datetime import date

import pytest

CATALOG_WRITES = [
    ("/api/products", {"name": "Blocked", "product_type": "SERVICE", "sales_price": 1, "cost_price": 1}),
    ("/api/plans", {"name": "Blocked", "billing_frequency": "MONTHLY", "plan_price": 1}),
    ("/api/tax-rules", {"name": "Blocked", "rate_percent": 5}),
    ("/api/discount-rules", {"name": "Blocked", "discount_type": "PERCENT", "value": 5, "scope": "PRODUCT"}),
]


@pytest.mark.parametrize("role", ["staff", "customer"])
@pytest.mark.parametrize("path, payload", CATALOG_WRITES, ids=["products", "plans", "tax-rules", "discount-rules"])
def test_only_the_admin_can_change_catalog_taxes_and_discounts(api, role, path, payload):
    assert api.c.post(path, headers=getattr(api, role), json=payload).status_code == 403


def test_admin_builds_catalog_with_variant_price_delta_and_templates(api):
    product = api.c.post("/api/products", headers=api.admin, json={
        "name": "Permission Suite Product", "product_type": "SERVICE", "sales_price": 1500, "cost_price": 400, "notes": "test"})
    assert product.status_code == 201
    pid = product.json()["id"]
    variant = {"attribute_name": "Brand", "attribute_value": "Odoo", "price_extra": 560}
    assert api.c.post(f"/api/products/{pid}/variants", headers=api.staff, json=variant).status_code == 403
    assert api.c.post(f"/api/products/{pid}/variants", headers=api.admin, json=variant).status_code == 201
    listed = next(p for p in api.c.get("/api/products", headers=api.admin).json() if p["id"] == pid)
    assert listed["variants"][0]["price_extra"] == 560

    template = {"name": "Permission Suite Template", "plan_id": api.catalog.monthly["id"], "validity_days": 15,
                "lines": [{"product_id": pid, "quantity": 1}]}
    assert api.c.post("/api/quotation-templates", headers=api.staff, json=template).status_code == 403
    assert api.c.post("/api/quotation-templates", headers=api.admin, json=template).status_code == 201


def test_percentage_discounts_cannot_exceed_100(api):
    rule = {"name": "Too generous", "discount_type": "PERCENT", "value": 150, "scope": "PRODUCT"}
    assert api.c.post("/api/discount-rules", headers=api.admin, json=rule).status_code == 400


def test_staff_can_read_everything_needed_for_daily_work(api):
    for path in ["/api/products", "/api/plans", "/api/tax-rules", "/api/discount-rules", "/api/quotation-templates",
                 "/api/customers", "/api/subscriptions", "/api/invoices", "/api/payments", "/api/analytics/summary"]:
        assert api.c.get(path, headers=api.staff).status_code == 200, path
    assert api.c.get("/api/team/staff", headers=api.staff).status_code == 403  # team management is admin-only


@pytest.mark.parametrize("path", ["/api/discount-rules", "/api/quotation-templates", "/api/customers",
                                  "/api/team/staff", "/api/analytics/summary"])
def test_customers_cannot_see_internal_data(api, path):
    assert api.c.get(path, headers=api.customer).status_code == 403


def test_customers_cannot_quote_invoice_bill_or_record_payments(api):
    customer = api.new_customer()
    today = date.today().isoformat()
    quote = {"template_id": api.catalog.template["id"], "customer_id": customer.id, "start_date": today}
    assert api.c.post("/api/subscriptions/from-template", headers=customer.headers, json=quote).status_code == 403
    manual = {"customer_id": customer.id, "plan_id": api.catalog.monthly["id"], "start_date": today,
              "lines": [{"product_id": api.catalog.erp["id"], "quantity": 1}]}
    assert api.c.post("/api/subscriptions", headers=customer.headers, json=manual).status_code == 403
    assert api.c.post("/api/billing/batch", headers=customer.headers, json={}).status_code == 403
    payment = {"invoice_id": 1, "payment_method": "UPI", "amount": 1, "payment_date": today}
    assert api.c.post("/api/payments", headers=customer.headers, json=payment).status_code == 403


def test_customers_only_see_their_own_subscriptions_and_invoices(api):
    alice, bob = api.new_customer("Customer A"), api.new_customer("Customer B")
    sub_a = api.active_monthly(alice.id)
    sub_b = api.active_monthly(bob.id)
    invoice_b = api.invoice(sub_b["id"])

    own = api.c.get("/api/subscriptions", headers=alice.headers).json()
    assert [s["id"] for s in own] == [sub_a["id"]]
    assert api.c.get(f"/api/subscriptions/{sub_b['id']}", headers=alice.headers).status_code == 403
    assert api.c.get(f"/api/invoices/{invoice_b['id']}", headers=alice.headers).status_code == 403
    assert invoice_b["id"] not in {i["id"] for i in api.c.get("/api/invoices", headers=alice.headers).json()}
    assert api.c.get(f"/api/invoices/{invoice_b['id']}", headers=bob.headers).status_code == 200
    assert api.c.post(f"/api/invoices/{invoice_b['id']}/confirm", headers=bob.headers).status_code == 403
