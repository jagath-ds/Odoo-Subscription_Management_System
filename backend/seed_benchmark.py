"""Scale benchmark: bulk-load thousands of subscriptions/invoices, then time the API.

Usage (inside the venv, from the repository root, API running, demo seed done):
    python -m backend.seed_benchmark                 # load 5,000 subs + 15,000 invoices, then benchmark
    python -m backend.seed_benchmark --subs 10000    # custom volume
    python -m backend.seed_benchmark --verify-only   # just time the endpoints

Loading is idempotent: rows are tagged SUB-BENCH-* and only the missing volume
is added. The benchmark logs in as the demo admin and checks every page-backing
endpoint responds well under the 2-second requirement.
"""

import argparse
import os
import random
import statistics
import time
from datetime import date, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import insert

from .core import config
from .core.auth import hash_password
from .core.database import SessionLocal
from .core.models import (
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    Plan,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
    TaxRule,
    User,
    UserRole,
)

CENT = Decimal("0.01")
BATCH = 1000


def load(target_subs: int) -> None:
    db = SessionLocal()
    try:
        existing = db.query(Subscription).filter(Subscription.sub_number.like("SUB-BENCH-%")).count()
        if existing >= target_subs:
            print(f"Benchmark data already present ({existing} subscriptions).")
            return
        erp = db.query(Product).filter_by(name="Brightloop Cloud ERP").one()
        odoo = db.query(ProductVariant).filter_by(product_id=erp.id, attribute_value="Odoo").one()
        gst = db.query(TaxRule).filter_by(name="GST 18%").one()
        plans = db.query(Plan).all()
        unit = erp.sales_price + odoo.price_extra

        # Customer pool (one password hash reused for speed).
        pw = hash_password(os.getenv("DEMO_PASSWORD", "Brightloop@123"))
        have = db.query(User.id).filter(User.email.like("bench-%@example.com")).count()
        if have < 250:
            db.execute(insert(User), [
                {"email": f"bench-{i}@example.com", "full_name": f"Bench Customer {i}", "role": UserRole.CUSTOMER, "password_hash": pw}
                for i in range(have, 250)
            ])
        customers = [u for (u,) in db.query(User.id).filter(User.email.like("bench-%@example.com")).all()]

        rng = random.Random(42)
        today = date.today()
        statuses = [SubscriptionStatus.ACTIVE] * 7 + [SubscriptionStatus.PAUSED, SubscriptionStatus.CLOSED, SubscriptionStatus.QUOTATION]
        started = time.perf_counter()
        for offset in range(existing, target_subs, BATCH):
            n = min(BATCH, target_subs - offset)
            sub_rows = []
            for i in range(offset, offset + n):
                start = today - timedelta(days=rng.randint(30, 700))
                sub_rows.append({
                    "sub_number": f"SUB-BENCH-{i:06d}", "customer_id": rng.choice(customers), "plan_id": rng.choice(plans).id,
                    "status": rng.choice(statuses), "start_date": start, "next_billing_date": today + timedelta(days=rng.randint(-3, 30)),
                    "expiry_date": start + timedelta(days=730), "payment_terms_days": 15,
                })
            sub_ids = list(db.scalars(insert(Subscription).returning(Subscription.id, sort_by_parameter_order=True), sub_rows))
            qtys = [rng.randint(1, 12) for _ in sub_ids]
            db.execute(insert(SubscriptionLine), [
                {"subscription_id": sid, "product_id": erp.id, "variant_id": odoo.id, "tax_id": gst.id, "quantity": q, "unit_price": unit}
                for sid, q in zip(sub_ids, qtys)
            ])

            inv_rows, meta = [], []
            for row, sid, q in zip(sub_rows, sub_ids, qtys):
                subtotal = (unit * q).quantize(CENT)
                tax = (subtotal * gst.rate_percent / 100).quantize(CENT)
                total = subtotal + tax
                for k in range(3):
                    issued = today - timedelta(days=30 * (k + 1) + rng.randint(0, 5))
                    status = rng.choice([InvoiceStatus.PAID, InvoiceStatus.PAID, InvoiceStatus.CONFIRMED,
                                         InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED])
                    paid = total if status == InvoiceStatus.PAID else (total / 2).quantize(CENT) if status == InvoiceStatus.PARTIALLY_PAID else Decimal("0")
                    inv_rows.append({
                        "invoice_number": f"INV-BENCH-{sid}-{k}", "subscription_id": sid, "customer_id": row["customer_id"],
                        "billing_period_key": f"{row['sub_number']}:{issued.isoformat()}", "status": status,
                        "issue_date": issued, "due_date": issued + timedelta(days=15), "subtotal": subtotal,
                        "total_discount": Decimal("0"), "total_tax": tax, "grand_total": total, "amount_paid": paid,
                    })
                    meta.append((q, subtotal, tax, total, paid, issued))
            inv_ids = list(db.scalars(insert(Invoice).returning(Invoice.id, sort_by_parameter_order=True), inv_rows))
            db.execute(insert(InvoiceLine), [
                {"invoice_id": iid, "product_name_snapshot": erp.name, "variant_name_snapshot": "Brand: Odoo", "quantity": q,
                 "unit_price_snapshot": unit, "discount_amount": Decimal("0"), "tax_percent_snapshot": gst.rate_percent,
                 "tax_amount": tax, "line_total": total}
                for iid, (q, subtotal, tax, total, paid, issued) in zip(inv_ids, meta)
            ])
            payments = [
                {"invoice_id": iid, "payment_method": rng.choice(list(PaymentMethod)), "amount": paid,
                 "payment_date": issued + timedelta(days=5), "note": "Benchmark payment"}
                for iid, (q, subtotal, tax, total, paid, issued) in zip(inv_ids, meta) if paid > 0
            ]
            if payments:
                db.execute(insert(Payment), payments)
            db.commit()
            print(f"  loaded {offset + n:>6} subscriptions ({(offset + n) * 3} invoices)")
        print(f"Loaded benchmark data in {time.perf_counter() - started:.1f}s")
    finally:
        db.close()


def benchmark(runs: int = 5) -> bool:
    base = os.getenv("SMOKE_BASE_URL") or f"http://{config.API_HOST}:{config.API_PORT}"
    client = httpx.Client(base_url=base, timeout=30)
    token = client.post("/api/auth/login", json={
        "email": os.getenv("DEMO_ADMIN_EMAIL", "admin@brightloop.local"),
        "password": os.getenv("DEMO_PASSWORD", "Brightloop@123"),
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    db = SessionLocal()
    counts = {m.__tablename__: db.query(m).count() for m in (Subscription, Invoice, Payment)}
    db.close()
    print(f"\nBenchmark against {base} with {counts}")
    endpoints = [
        "/api/analytics/summary",
        "/api/subscriptions",
        "/api/subscriptions?status=ACTIVE",
        "/api/invoices",
        "/api/invoices?is_overdue=true",
        "/api/payments",
        "/api/notifications",
        "/api/products",
    ]
    ok = True
    print(f"{'endpoint':<36}{'median ms':>10}{'max ms':>10}{'server ms':>12}  result")
    for path in endpoints:
        samples, server = [], ""
        for _ in range(runs):
            t = time.perf_counter()
            r = client.get(path, headers=headers)
            samples.append((time.perf_counter() - t) * 1000)
            server = r.headers.get("x-process-time", "")
            r.raise_for_status()
        worst = max(samples)
        passed = worst < 2000
        ok &= passed
        print(f"{path:<36}{statistics.median(samples):>10.1f}{worst:>10.1f}{server:>12}  {'PASS' if passed else 'FAIL'} (<2000 ms)")
    summary = client.get("/api/analytics/summary", headers=headers).json()
    print(f"\nFinance summary query_time_ms = {summary['query_time_ms']} "
          f"(active={summary['active_subscriptions_count']}, overdue={summary['overdue_invoices_count']})")
    print("ALL ENDPOINTS UNDER 2 SECONDS" if ok else "SOME ENDPOINTS EXCEEDED 2 SECONDS")
    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--subs", type=int, default=5000, help="target number of benchmark subscriptions")
    parser.add_argument("--verify-only", action="store_true", help="skip loading, only time the endpoints")
    args = parser.parse_args()
    if not args.verify_only:
        load(args.subs)
    raise SystemExit(0 if benchmark() else 1)
