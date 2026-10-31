"""Finance lead summary (Contract C): shape, speed, access and agreement with the invoice ledger."""

from datetime import date, timedelta

import pytest

KEYS = {"query_time_ms", "active_subscriptions_count", "mrr_collected", "total_outstanding_owed",
        "overdue_invoices_count", "overdue_invoices"}


def test_summary_shape_speed_and_process_time_header(api):
    response = api.c.get("/api/analytics/summary", headers=api.admin)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == KEYS
    assert body["query_time_ms"] < 2000
    assert response.headers["X-Process-Time"].endswith("ms")
    print(f"\nquery_time_ms={body['query_time_ms']}  X-Process-Time={response.headers['X-Process-Time']}")


def test_summary_matches_the_subscription_and_invoice_ledger(api):
    summary = api.c.get("/api/analytics/summary", headers=api.admin).json()
    subscriptions = api.c.get("/api/subscriptions", headers=api.admin).json()
    invoices = api.c.get("/api/invoices", headers=api.admin).json()
    open_invoices = [i for i in invoices if i["status"] in ("CONFIRMED", "PARTIALLY_PAID")]

    assert summary["active_subscriptions_count"] == sum(s["status"] == "ACTIVE" for s in subscriptions)
    assert summary["mrr_collected"] == pytest.approx(sum(i["amount_paid"] for i in invoices if i["status"] != "CANCELLED"))
    assert summary["total_outstanding_owed"] == pytest.approx(sum(i["grand_total"] - i["amount_paid"] for i in open_invoices))
    assert summary["overdue_invoices_count"] == sum(i["is_overdue"] for i in invoices)
    overdue_ids = {i["id"] for i in api.c.get("/api/invoices?is_overdue=true", headers=api.admin).json()}
    assert {row["invoice_id"] for row in summary["overdue_invoices"]} == overdue_ids


def test_overdue_rows_report_days_overdue(api):
    rows = api.c.get("/api/analytics/summary", headers=api.admin).json()["overdue_invoices"]
    assert rows, "the seed contains overdue invoices"
    for row in rows:
        days = (date.today() - date.fromisoformat(row["due_date"])).days
        assert row["days_overdue"] == days > 0 and row["amount_due"] > 0


def test_simulated_future_date_reports_more_overdue_invoices(api):
    now = api.c.get("/api/analytics/summary", headers=api.admin).json()
    later_date = (date.today() + timedelta(days=60)).isoformat()
    later = api.c.get(f"/api/analytics/summary?today={later_date}", headers=api.admin).json()
    assert later["overdue_invoices_count"] > now["overdue_invoices_count"]


def test_summary_is_for_staff_and_admin_only(api):
    assert api.c.get("/api/analytics/summary", headers=api.staff).status_code == 200
    assert api.c.get("/api/analytics/summary", headers=api.customer).status_code == 403
    assert api.c.get("/api/analytics/summary").status_code == 401
