# BrightLoop Subscription ERP

One platform to run plans, subscriptions and recurring billing for **Brightloop Software**:
catalog and pricing rules, quotations, the subscription lifecycle, automated Billing Day
invoicing, payments, a customer self-service portal and a finance dashboard.

Built for the Odoo Hackathon problem statement
[`docs/Subscription_Management_System.pdf`](docs/Subscription_Management_System.pdf), following the
team blueprint in [`docs/`](docs/).

**Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2 · PostgreSQL 15+ · React 18 + TypeScript · Vite · Tailwind CSS

---

## Contents

1. [What it does](#1-what-it-does)
2. [Architecture](#2-architecture)
3. [Quickstart (automated)](#3-quickstart-automated)
4. [Manual setup](#4-manual-setup)
5. [Configuration (`.env` files)](#5-configuration-env-files)
6. [Database: initialise, seed, reset](#6-database-initialise-seed-reset)
7. [Running the app](#7-running-the-app)
8. [Demo accounts and demo data](#8-demo-accounts-and-demo-data)
9. [Tests and the <2 s scale benchmark](#9-tests-and-the-2-s-scale-benchmark)
10. [API overview](#10-api-overview)
11. [Business rules and edge cases](#11-business-rules-and-edge-cases)
12. [Branches and known limitations](#12-branches-and-known-limitations)

---

## 1. What it does

Every scene in the problem statement maps to a working feature:

| Problem-statement scene | What the system does | UI | API |
| --- | --- | --- | --- |
| A new customer signs up | One account per email; password **more than 8 characters** with upper, lower and special character; reset link by email; roles ADMIN / STAFF / CUSTOMER; only the admin adds staff | `/signup`, `/login` (Forgot password), `/reset-password`, `/team` | `/api/auth/*`, `/api/team/staff` |
| Launching a new plan | Products (type, sales and cost price, notes) with variants (Brand: Odoo **+560**); plans billed daily / weekly / monthly / yearly with minimum quantity, availability dates and per-plan flags: auto-close, close early, pause, renew | `/catalog/*` | `/api/products`, `/api/variants`, `/api/plans` |
| Turning a quote into a subscription | Quotation templates (plan + lines + validity days); each subscription has a number, customer, plan, start and expiry date, payment terms and priced lines; **Draft → Quotation → Confirmed → Active → Paused / Closed**; expired quotations cannot be confirmed | `/quotations/new`, `/subscriptions/:id` | `/api/quotation-templates`, `/api/subscriptions/*` |
| Billing day | One click invoices every due subscription with customer, lines, taxes and totals filled in; invoices go **Draft → Confirmed → Paid**; confirm, cancel, send, print; nothing is billed twice or skipped | `/billing`, `/invoices/:id` | `/api/billing/batch`, `/api/invoices/*` |
| A customer asks for a better price | Admin-only discount rules (fixed or %, minimum quantity or purchase, start and end dates, usage limit) for products or whole subscriptions; applied to the next invoice automatically and stopped once expired or used up | `/catalog/discount-rules` | `/api/discount-rules` |
| The money comes in | Payments with method, amount, date and note against an invoice; partial payments; paid vs outstanding vs overdue | `/payments`, invoice detail | `/api/payments` |
| The finance lead, at month end | Active subscriptions, revenue collected, amount owed and the overdue chase list with filters and a live query-time badge; every page answers in well under 2 s with thousands of subscriptions | `/dashboard` | `/api/analytics/summary` |
| Customers manage their own subscriptions | Portal with only their subscriptions and invoices; switch add-ons on/off; pause, resume or renew when the plan allows it | `/portal` | same endpoints, scoped to the customer |

---

## 2. Architecture

```text
.
├── backend/
│   ├── core/                 # Member 1 – foundation
│   │   ├── config.py         #   loads every setting from .env
│   │   ├── database.py       #   SQLAlchemy engine + session
│   │   ├── models.py         #   12 blueprint tables + payments, indexes, unique constraints
│   │   ├── schemas.py        #   Pydantic request/response contracts (blueprint Section 5)
│   │   └── auth.py           #   JWT, password policy, role guards
│   ├── engine/               # Member 2 – pure business logic (no DB, no HTTP)
│   │   ├── pricing.py        #   unit + variant, discounts, tax, line totals (Decimal)
│   │   ├── state_machine.py  #   lifecycle transitions, plan permissions, pause date-shift
│   │   └── billing_job.py    #   Billing Day decision: BILL / SKIP / AUTO_CLOSE, period keys
│   ├── services/             # Member 4 – binds the engine to the database
│   │   ├── pricing_service.py#   prices a subscription (auto-applies eligible discounts)
│   │   ├── invoicing.py      #   invoice snapshots + Billing Day batch with savepoints
│   │   └── presenters.py     #   builds the shared JSON contracts A and B
│   ├── api/                  # FastAPI routers (auth, catalog, subscriptions, invoices, analytics)
│   ├── main.py               # app entrypoint, CORS, X-Process-Time header
│   ├── seed.py               # clean demo data
│   └── seed_benchmark.py     # 5,000-subscription scale benchmark
├── frontend/                 # Member 3 – React + Vite workspace, portal and dashboard
│   └── src/
│       ├── pages/            #   one file per screen
│       ├── components/       #   layout, auth, catalog, subscriptions, billing, finance, ui
│       ├── services/api.ts   #   the only data entry point -> live.adapter.ts (FastAPI) or mock.adapter.ts
│       ├── types/contracts.ts#   shared API types
│       └── mocks/            #   offline demo store (VITE_USE_MOCK=true)
├── scripts/
│   ├── init_db.py            # create (or --reset) the PostgreSQL database and schema
│   └── backend_smoke_test.py # end-to-end API test of the core workflows
├── tests/                    # 35 engine unit tests (pytest)
├── docs/                     # problem statement, team blueprint, TEAM-GUIDE.md
├── setup.ps1 / setup.cmd / setup.sh
├── requirements.txt          # pinned backend dependencies
├── .env.example              # backend config template
└── frontend/.env.example     # frontend config template
```

Request flow: **React page → `services/api.ts` → FastAPI router (`backend/api`) → `backend/services`
→ pure `backend/engine` rules → SQLAlchemy models (`backend/core`) → PostgreSQL.**

---

## 3. Quickstart (automated)

**Prerequisites:** Python **3.11+**, Node.js **22 LTS+**, PostgreSQL **15+** running locally, and
your PostgreSQL password.

```bash
git clone https://github.com/jagath-ds/Odoo-Subscription_Management_System.git
cd Odoo-Subscription_Management_System
```

| OS | Command (repository root) |
| --- | --- |
| Windows | `setup.cmd` (double-click works), or `powershell -ExecutionPolicy Bypass -File setup.ps1` |
| macOS / Linux | `chmod +x setup.sh && ./setup.sh` |

The script creates `venv`, installs `requirements.txt` into it, copies `.env.example` → `.env`
(with a random `JWT_SECRET_KEY`) and `frontend/.env.example` → `frontend/.env`, creates the
`brightloop_erp` database and tables, seeds the demo data and runs `npm install` in `frontend/`.

> **First run:** the script stops before the database step until you set your PostgreSQL
> password. Open `.env`, replace `YOUR_POSTGRES_PASSWORD` in `DATABASE_URL`, then run the
> script again. Re-running is always safe.

Then [start the backend and the frontend](#7-running-the-app).

---

## 4. Manual setup

<details open>
<summary><b>Windows – PowerShell</b></summary>

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
Copy-Item .env.example .env           # then edit DATABASE_URL and JWT_SECRET_KEY
Copy-Item frontend\.env.example frontend\.env
python scripts\init_db.py
python -m backend.seed
cd frontend; npm install; cd ..
```
</details>

<details>
<summary><b>Windows – Command Prompt (CMD)</b></summary>

```bat
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env
copy frontend\.env.example frontend\.env
python scripts\init_db.py
python -m backend.seed
cd frontend && npm install && cd ..
```
</details>

<details>
<summary><b>macOS / Linux</b></summary>

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                  # then edit DATABASE_URL and JWT_SECRET_KEY
cp frontend/.env.example frontend/.env
python scripts/init_db.py
python -m backend.seed
(cd frontend && npm install)
```
</details>

Generate a JWT secret with `python -c "import secrets; print(secrets.token_hex(32))"`.

---

## 5. Configuration (`.env` files)

Nothing is hard-coded: every URL, port and secret comes from these files. Both `.env` files are
git-ignored; the `.env.example` templates are committed.

### Backend – `.env` (repository root)

| Variable | Example | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `development` enables auto-reload for `python -m backend.main` |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `8000` | Where `python -m backend.main` listens; also used by the test scripts |
| `DATABASE_URL` | `postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/brightloop_erp` | PostgreSQL connection. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`) |
| `JWT_SECRET_KEY` | 64 random hex characters | Signs login and password-reset tokens (required) |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Login session length |
| `RESET_TOKEN_EXPIRE_MINUTES` | `30` | Lifetime of a password-reset link |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used to build reset links |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origins allowed to call the API |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | empty / `587` | Optional email delivery for reset links. Leave `SMTP_HOST` empty to print links in the API console |
| `DEMO_ADMIN_EMAIL`, `DEMO_STAFF_EMAIL`, `DEMO_CUSTOMER_EMAIL`, `DEMO_PASSWORD` | see `.env.example` | Accounts created by `python -m backend.seed` |

### Frontend – `frontend/.env`

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | FastAPI base URL (no trailing slash) |
| `VITE_USE_MOCK` | `false` | `false` = live backend (default); `true` = offline in-memory demo data |

Restart `npm run dev` after editing `frontend/.env`. If you run the frontend on another port, add
that origin to `CORS_ORIGINS`.

---

## 6. Database: initialise, seed, reset

All commands run from the repository root with the venv active (or prefix them with
`venv\Scripts\python` on Windows / `venv/bin/python` on macOS/Linux instead of `python`).

| Task | Command |
| --- | --- |
| Create the `brightloop_erp` database (if missing), all tables, indexes and constraints | `python scripts/init_db.py` |
| Load the clean demo data (idempotent) | `python -m backend.seed` |
| **Reset** to a fresh, clean demo (drops all data) | `python scripts/init_db.py --reset` then `python -m backend.seed` |

`init_db.py` connects to the server's `postgres` database to run `CREATE DATABASE`, so you never
need pgAdmin. It prints the tables and the key indexes: `(status, next_billing_date)` on
subscriptions, `(status, due_date)` on invoices and `UNIQUE (subscription_id, billing_period_key)`
on invoices.

---

## 7. Running the app

Use two terminals, both in the repository root.

**Terminal 1 – backend** (venv active):

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

* API: <http://127.0.0.1:8000> · health: <http://127.0.0.1:8000/api/health>
* Swagger UI: <http://127.0.0.1:8000/docs> (click **Authorize**, enter the email as *username*) · ReDoc: <http://127.0.0.1:8000/redoc>
* Alternative: `python -m backend.main` (uses `API_HOST` / `API_PORT` from `.env`)

**Terminal 2 – frontend:**

```bash
cd frontend
npm run dev
```

* App: <http://localhost:5173>
* Production build check: `npm run build`

---

## 8. Demo accounts and demo data

All demo accounts use the password **`Brightloop@123`**.

| Role | Email | What they see |
| --- | --- | --- |
| ADMIN | `admin@brightloop.local` | Everything: dashboard, catalog and rules studio, discounts, team (adds staff), operations |
| STAFF | `staff@brightloop.local` | Day-to-day work: quotations, subscriptions, Billing Day, invoices, payments |
| CUSTOMER | `customer@brightloop.local` (Acme Retail Pvt Ltd) | Self-service portal: own subscriptions and invoices only |
| CUSTOMER | `billing@novatraders.example` (Nova Traders) | Self-service portal |

`python -m backend.seed` creates the blueprint catalog and sample activity:

* **Catalog:** *Brightloop Cloud ERP* (SERVICE, ₹2,000, cost ₹500) with variants *Brand: Odoo* (+₹560 → ₹2,560) and *Brand: Standard*; *WhatsApp Automated Alerts* (ADDON, ₹300).
* **Plans:** *Monthly Starter Plan* (monthly, min 1) and *Annual Enterprise Plan* (yearly, min 5 seats, pausable, no early close, auto-close).
* **Rules:** *GST 18%*; *10% Off for >=10 seats* (percent, min qty 10, max 50 uses, valid until 31 Dec).
* **Template:** *Enterprise Annual Offer* (Annual Enterprise Plan, 10 × Cloud ERP Odoo + WhatsApp, valid 30 days).
* **Subscriptions:** SUB-DEMO-0001…0006 covering ACTIVE, PAUSED and QUOTATION, one **due today** (billed on the next Billing Day run) and one **expired on an auto-close plan** (closed by Billing Day).
* **Invoices:** Draft, Confirmed, Overdue, Partially Paid and Paid, with payments.

### Five-minute demo script

1. **Admin → Dashboard:** KPIs, overdue chase list and the ⚡ query-time badge.
2. **Catalog:** the Odoo variant (+560), plan flags, GST 18% and the 10% bulk-seat discount.
3. **Staff → New quotation from template** *Enterprise Annual Offer*: 10 × ₹2,560, 10% off, 18% GST are filled in automatically. Move it Draft → Quotation → Confirmed → Active with the action buttons.
4. **Billing Day → Run Billing Day:** SUB-DEMO-0005 gets a Draft invoice and SUB-DEMO-0006 is auto-closed. Run it again: nothing is billed twice.
5. **Invoice → Confirm**, then **Record payment:** pay part (PARTIALLY_PAID), then the rest (PAID). Print it.
6. **Customer portal** (`customer@brightloop.local`): switch the WhatsApp add-on, pause and resume (billing dates shift by the paused days).
7. **Sign-up** with `Short@1a` is rejected (needs more than 8 characters). **Forgot password** prints the reset link in the API console.

---

## 9. Tests and the <2 s scale benchmark

Run from the repository root with the venv active and, for the last three, the backend running.

```bash
python -m pytest -q                         # 35 engine unit tests (pricing, lifecycle, billing)
python scripts/backend_smoke_test.py        # end-to-end API test of every core workflow
python -m backend.seed_benchmark            # load 5,000 subscriptions + 15,000 invoices, then time every page endpoint
```

The benchmark logs in as the demo admin and fails if any endpoint takes 2 seconds or more.
`python -m backend.seed_benchmark --verify-only` re-times without loading, and `--subs 10000`
loads more. The smoke test and the benchmark add records to the database: afterwards, restore the
clean demo with `python scripts/init_db.py --reset` and `python -m backend.seed`.

Measured locally (PostgreSQL 18, 5,005 subscriptions, 15,006 invoices, 7,515 payments; slowest of 5 runs):

| Endpoint | Response |
| --- | --- |
| `GET /api/analytics/summary` (finance dashboard) | ~30 ms (SQL ~15 ms) |
| `GET /api/subscriptions` | ~107 ms |
| `GET /api/invoices`, `?is_overdue=true` | ~31–35 ms |
| `GET /api/payments` | ~26 ms |

Every API response carries an `X-Process-Time` header with the server-side time.

---

## 10. API overview

Full, interactive reference: <http://127.0.0.1:8000/docs>. All routes except signup, login and
password reset need `Authorization: Bearer <token>`.

| Area | Endpoints | Access |
| --- | --- | --- |
| Auth | `POST /api/auth/signup`, `/login`, `/token` (Swagger form), `/forgot-password`, `/reset-password`; `GET /api/auth/me` | Public / signed-in |
| Team | `GET, POST /api/team/staff`; `GET /api/customers` | Admin / staff + admin |
| Catalog | `/api/products` (+ `/{id}/variants`), `/api/variants/{id}`, `/api/plans`, `/api/tax-rules`, `/api/discount-rules`, `/api/quotation-templates` | Read: signed-in · write: admin |
| Subscriptions | `GET, POST /api/subscriptions`, `POST /from-template`, `GET /{id}`, `POST /{id}/transition`, `/{id}/toggle-addon`, `/{id}/invoice` | Staff + admin; customers for their own (pause, resume, renew, add-ons) |
| Invoices | `GET /api/invoices` (`status`, `is_overdue`, `q`), `GET /{id}`, `POST /{id}/confirm`, `/cancel`, `/send`, `/remind`, `GET /{id}/print` | Staff + admin; customers read their own |
| Payments | `GET /api/payments`, `POST /api/payments` | Record: staff + admin |
| Billing Day | `POST /api/billing/batch` (`{"today": "YYYY-MM-DD"}` optional) | Staff + admin |
| Analytics | `GET /api/analytics/summary`, `GET /api/notifications` | Staff + admin / signed-in |

---

## 11. Business rules and edge cases

| Rule | How it is enforced |
| --- | --- |
| No double billing | Period key `{sub_number}:{billing_date}` checked by the engine **and** `UNIQUE (subscription_id, billing_period_key)`; each subscription is billed inside its own savepoint, so one bad record never blocks the batch |
| Past invoices never change | Invoice lines snapshot product name, variant, unit price, discount and tax rate at billing time |
| Discounts start and stop on their own | The best eligible rule is applied automatically; date window, minimum quantity / purchase and remaining uses are checked every cycle; `current_uses` increments atomically |
| Fair billing after a pause | Resuming shifts `next_billing_date` and `expiry_date` forward by the paused days |
| Partial payments | `PARTIALLY_PAID` until the amount due reaches 0; over-payments are rejected; payments only on confirmed invoices |
| Quotation validity | Template `validity_days` sets `quotation_valid_until`; confirming after that date is refused |
| Plan permissions | Pause, early close and renew follow the plan flags; auto-close plans are closed by Billing Day at expiry |
| Accounts | Unique email (case-insensitive); password more than 8 characters with upper, lower and special character; reset links are single-use and expire |
| Roles | Admin: everything · Staff: operations, no catalog writes or staff creation · Customer: own records only |
| Money | `NUMERIC(12,2)` columns and Python `Decimal` with half-up rounding; no floating-point drift |

---

## 12. Branches and known limitations

| Branch | Contents |
| --- | --- |
| `main` | Integrated, working full stack |
| `test/integration` | Staging branch used to integrate the three member branches |
| `backend`, `features`, `front-end` | Original member branches, kept as backups |

Known limitations:

* Tables are created with SQLAlchemy `create_all` (no Alembic migrations yet). After changing models, run `python scripts/init_db.py --reset`.
* Without SMTP settings, password-reset links are printed in the API console, and invoice *Send* / *Remind* do not email the customer.
* Quotation validity is enforced when a quotation is confirmed.

More detail for contributors: [`docs/TEAM-GUIDE.md`](docs/TEAM-GUIDE.md).
