# Brightloop Software – Subscription & Recurring Billing ERP

> **Odoo Hackathon Project**<br>
> **Team Architecture:** Contract-First, 4-Member Isolation<br>
> **Branch:** `features`

---

## 1. Project Overview

Brightloop Software sells B2B recurring software subscriptions, add-on modules, and product variants. This repository hosts the Subscription & Recurring Billing Management ERP platform that automates:
- Catalog setup (products, variants, plans, tax rules, and discount rules)
- Quotation templates and sales offer generation
- Contract lifecycle state pipeline (`DRAFT` → `QUOTATION` → `CONFIRMED` → `ACTIVE` → `PAUSED` / `CLOSED`)
- Automated billing day evaluations and batch invoice generation
- Payment ledger and sub-2-second finance metrics

---

## 2. Member 2 Responsibilities – Features & Business Logic Engine

As **Member 2**, this module encapsulates all pure financial calculations, lifecycle state rules, and automated billing evaluation logic in `backend/engine/`:

1. **Pricing Engine (`backend/engine/pricing.py`):**
   - Precise financial math using Python `decimal.Decimal` with `ROUND_HALF_UP` to 2 decimal places.
   - Calculates effective unit price (`base_price + variant_extra`).
   - Calculates gross amount (`unit_price * quantity`).
   - Validates discount eligibility (date validity window, minimum quantity, minimum gross purchase, usage limit).
   - Supports percentage and fixed-amount discounts without reducing taxable amount below zero.
   - Computes GST/tax and final line total.

2. **Subscription State Machine (`backend/engine/state_machine.py`):**
   - Enforces transition pipeline: `DRAFT` → `QUOTATION` → `CONFIRMED` → `ACTIVE` → `PAUSED` / `CLOSED`.
   - Validates plan permissions (`can_pause`, `can_close_early`, `can_renew`).
   - Tracks pause dates (`paused_at`), calculates paused duration in calendar days, and shifts both `next_billing_date` and `expiry_date` forward by the exact paused days upon resumption.
   - Preserves state atomically on rejection (failed transitions never mutate state).

3. **Automated Billing Evaluator (`backend/engine/billing_job.py`):**
   - Evaluates due dates (`next_billing_date <= today_str`) and subscription status (`ACTIVE`).
   - Generates deterministic idempotency keys (`{sub_number}:{next_billing_date}`).
   - Detects existing billing keys to prevent duplicate invoicing.
   - Automatically closes expired subscriptions when `auto_close` is enabled.
   - Uses `python-dateutil.relativedelta` for calendar-aware recurrence increments (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`) with leap-year and month-end awareness (e.g., Jan 31 + 1 month = Feb 28/29).

---

## 3. Project Folder Structure

```
Project odoo/
├── .env.example              # Safe placeholder environment template for teammates
├── .gitignore                 # Standard exclusions (venv/, __pycache__, .env, etc.)
├── pytest.ini                 # Pytest root configuration (pythonpath = .)
├── README.md                  # Team setup, engine documentation, & integration manual
├── requirements.txt           # Minimal runtime and testing dependencies
├── backend/
│   ├── __init__.py           # Backend package marker
│   └── engine/               # Member 2 pure business logic modules
│       ├── __init__.py       # Engine package exports
│       ├── pricing.py        # calculate_line_item()
│       ├── state_machine.py  # check_subscription_transition()
│       └── billing_job.py    # evaluate_subscription_for_billing()
└── tests/                    # Comprehensive unit test suite (100% passing)
    ├── test_pricing.py       # 15 tests: pricing, variants, discounts, GST, rounding
    ├── test_state_machine.py # 11 tests: transitions, permissions, pause date shifts
    └── test_billing_job.py   # 9 tests: billing cycles, idempotency, leap years
```

---

## 4. Python Installation & Environment Setup

### Prerequisites
- **Python 3.11+** installed on your system.
- **Git** configured.

> [!IMPORTANT]
> **Virtual Environment Rule:** Every teammate must create their own local virtual environment. Never commit or copy the `venv/` directory across machines.

### Step-by-Step Setup

#### Windows (PowerShell)
```powershell
# 1. Create a local virtual environment named 'venv'
python -m venv venv

# 2. Activate the virtual environment
.\venv\Scripts\Activate.ps1

# (If script execution is restricted in PowerShell, run:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned)

# 3. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### Linux / macOS (Bash)
```bash
# 1. Create a local virtual environment named 'venv'
python3 -m venv venv

# 2. Activate the virtual environment
source venv/bin/activate

# 3. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 5. Environment Configuration

Copy `.env.example` to `.env` to configure your local database and secrets:

```powershell
# Windows
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

The engine modules are pure Python business logic and do not depend on `.env` directly, but the file is configured for Member 1 (Database) and Member 4 (FastAPI API).

---

## 6. How to Execute Unit Tests

Ensure your virtual environment is active, then run:

```bash
# Run the complete test suite with verbose output
pytest -v

# Run tests for an individual module
pytest tests/test_pricing.py -v
pytest tests/test_state_machine.py -v
pytest tests/test_billing_job.py -v
```

All 35 unit tests pass out of the box with zero warnings or errors.

---

## 7. Engine Function Reference & Usage Examples

### 7.1 Pricing Engine: `calculate_line_item()`

```python
from decimal import Decimal
from backend.engine.pricing import calculate_line_item

result = calculate_line_item(
    base_price=Decimal("2000.00"),
    variant_extra=Decimal("560.00"),
    quantity=2,
    tax_percent=Decimal("18.00"),
    discount={
        "type": "PERCENT",
        "value": Decimal("10.00"),
        "min_qty": 2,
        "valid_until": "2026-12-31",
        "uses_left": 50,
    },
    today_str="2026-10-31",
)

# Output dictionary:
# {
#     "unit_price": Decimal("2560.00"),
#     "gross_amount": Decimal("5120.00"),
#     "discount_amount": Decimal("512.00"),
#     "discount_applied": True,
#     "taxable_amount": Decimal("4608.00"),
#     "tax_amount": Decimal("829.44"),
#     "line_total": Decimal("5437.44")
# }
```

### 7.2 State Machine: `check_subscription_transition()`

```python
from backend.engine.state_machine import check_subscription_transition

# Example A: Pausing an active subscription
pause_res = check_subscription_transition(
    current_status="ACTIVE",
    target_status="PAUSED",
    plan_flags={"can_pause": True},
    next_billing_date="2026-11-01",
    expiry_date="2027-10-01",
    today_str="2026-10-15",
)
# Returns:
# {
#     "allowed": True,
#     "next_status": "PAUSED",
#     "next_billing_date": "2026-11-01",
#     "expiry_date": "2027-10-01",
#     "paused_at": "2026-10-15",
#     "error": None
# }

# Example B: Resuming paused subscription (16 days later)
resume_res = check_subscription_transition(
    current_status="PAUSED",
    target_status="ACTIVE",
    next_billing_date="2026-11-01",
    expiry_date="2027-10-01",
    paused_at="2026-10-15",
    today_str="2026-10-31",  # 16 paused days
)
# Returns:
# {
#     "allowed": True,
#     "next_status": "ACTIVE",
#     "next_billing_date": "2026-11-17",  # Shifted +16 days
#     "expiry_date": "2027-10-17",        # Shifted +16 days
#     "paused_at": None,
#     "error": None
# }
```

### 7.3 Automated Billing Evaluator: `evaluate_subscription_for_billing()`

```python
from backend.engine.billing_job import evaluate_subscription_for_billing

evaluation = evaluate_subscription_for_billing(
    sub_number="SUB-001",
    status="ACTIVE",
    billing_frequency="MONTHLY",
    next_billing_date="2026-10-31",
    expiry_date="2027-10-31",
    auto_close=True,
    today_str="2026-10-31",
    existing_period_keys={"SUB-001:2026-09-30"},
)

# Output dictionary:
# {
#     "action": "BILL",
#     "billing_period_key": "SUB-001:2026-10-31",
#     "next_billing_date": "2026-11-30",
#     "new_status": "ACTIVE",
#     "reason": "Subscription eligible for MONTHLY billing. Advanced next billing date to 2026-11-30."
# }
```

---

## 8. Integration Instructions for Member 4 (FastAPI & Database Wiring)

Member 4 can import and wire these modules directly into FastAPI endpoints and Celery/cron background jobs:

1. **In `sub_routes.py` (Quotation & Subscription Line Calculation):**
   - Query product `sales_price`, variant `price_extra`, and applicable tax and discount rules.
   - Pass them into `calculate_line_item(...)`.
   - Store results in `subscription_lines` (`unit_price`) or `invoice_lines` snapshots.

2. **In `sub_routes.py` (Lifecycle State Transitions):**
   - When a user clicks *Pause*, *Resume*, *Cancel*, or *Confirm* on the frontend ribbon, load the subscription record and associated `plan` boolean flags (`can_pause`, `can_close_early`, `can_renew`).
   - Call `check_subscription_transition(...)`.
   - If `allowed` is `False`, return HTTP 400 with `detail=result["error"]`.
   - If `allowed` is `True`, update `subscription.status`, `next_billing_date`, `expiry_date`, and `paused_at` in the DB session.

3. **In `billing_batch.py` or Background Job (Automated Billing Day):**
   - Query candidate subscriptions: `SELECT * FROM subscriptions WHERE status = 'ACTIVE' AND next_billing_date <= :today`.
   - In a loop (wrapped in a DB transaction savepoint):
     ```python
     eval_result = evaluate_subscription_for_billing(
         sub_number=sub.sub_number,
         status=sub.status,
         billing_frequency=sub.plan.billing_frequency,
         next_billing_date=sub.next_billing_date,
         expiry_date=sub.expiry_date,
         auto_close=sub.plan.auto_close,
         today_str=today,
         existing_period_keys=billed_keys_set,
     )

     if eval_result["action"] == "BILL":
         # 1. Create Invoice record with billing_period_key=eval_result["billing_period_key"]
         # 2. Advance sub.next_billing_date = eval_result["next_billing_date"]
         # 3. Commit or flush savepoint
     elif eval_result["action"] == "AUTO_CLOSE":
         # sub.status = 'CLOSED'
     ```
   - **Double-Billing Safeguard:** Application logic skips duplicate period keys in-memory. In addition, PostgreSQL enforces `UNIQUE(subscription_id, billing_period_key)` to guarantee concurrent idempotency under race conditions.

---

## 9. Team Git Workflow – `features` Branch

To maintain code isolation and zero Git merge conflicts:

1. **Verify you are on the `features` branch:**
   ```bash
   git status
   # Should report: On branch features
   ```

2. **Stage and commit Member 2 deliverables:**
   ```bash
   git add backend/engine/ tests/ requirements.txt pytest.ini .gitignore .env.example README.md
   git commit -m "feat(engine): implement pricing, state machine, and billing evaluator modules with unit tests"
   ```

3. **Push changes to remote (when ready and authorized):**
   ```bash
   git push origin features
   ```
