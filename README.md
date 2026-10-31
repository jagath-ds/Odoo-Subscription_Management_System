# BrightLoop Subscription ERP

Backend for the BrightLoop subscription-management hackathon project.

## What is implemented

The backend supports the core business flow:

`register/login -> catalog -> subscription -> lifecycle -> invoice -> payment -> overdue tracking`

Implemented capabilities:

- JWT authentication with admin, staff, and customer roles.
- Public registration creates customers only.
- Admin-only staff/admin/customer creation.
- Products, variants, plans, tax rules, discount rules, and quotation templates.
- Subscription creation and customer ownership isolation.
- Subscription lifecycle actions: quotation, confirm, activate, pause, resume, renew, and close.
- Invoice generation with line snapshots.
- Percentage/fixed discounts, date/quantity/purchase/usage constraints, and taxes.
- Staff/admin invoice confirmation, cancellation, send-readiness, printable HTML, payments, and overdue summaries.
- Idempotent demo seed data.
- Focused pricing and lifecycle tests.

## Architecture

```text
backend/
├── main.py                    # FastAPI composition and startup bootstrap
├── api/
│   ├── auth_routes.py         # Registration, login, current user, user creation
│   ├── catalog_routes.py      # Products, plans, taxes, discounts, templates
│   ├── subscription_routes.py # Subscription creation, access, lifecycle
│   └── invoice_routes.py      # Invoices, payments, overdue, printable output
├── core/
│   ├── auth.py                # JWT, password hashing, role guards
│   ├── database.py            # SQLAlchemy engine and sessions
│   ├── models.py              # Database entities and constraints
│   └── schemas.py             # API request/response contracts
├── engine/
│   ├── pricing.py             # Pure tax/discount calculations
│   ├── billing.py             # Invoice construction and snapshots
│   └── state_machine.py       # Subscription transition rules
└── seed.py                    # Repeatable local demo data
```

Catalog HTTP routes live only in `api/catalog_routes.py`; `core` contains shared infrastructure and models.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` locally and never commit it:

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/brightloop_erp
JWT_SECRET=use-a-long-random-secret
```

The database layer normalizes the PostgreSQL URL to the `psycopg` driver. PostgreSQL must be running and the `brightloop_erp` database must exist.

Start the API:

```powershell
python -m uvicorn backend.main:app --reload
```

Open Swagger at `http://127.0.0.1:8000/docs`.

Seed demo data:

```powershell
python -m backend.seed
```

Default demo accounts:

```text
Admin:    admin@brightloop.local
Customer: customer@brightloop.local
Password: Brightloop@123
```

Set `DEMO_PASSWORD`, `DEMO_ADMIN_EMAIL`, and `DEMO_CUSTOMER_EMAIL` before seeding if different values are required. Existing users are not overwritten by the seed script.

## API areas

| Area | Routes | Access |
|---|---|---|
| Auth | `/api/auth/register`, `/login`, `/me`, `/users` | Register public; user creation admin-only |
| Catalog | `/api/catalog/...` | Read authenticated; writes admin-only; staff can read operational rules/templates |
| Subscriptions | `/api/subscriptions` | Customers see their own; staff/admin see all |
| Lifecycle | `/api/subscriptions/{id}/actions` | Owner or staff/admin, subject to plan permissions |
| Invoices | `/api/invoices` | Customers see their own; staff/admin manage all |
| Invoice actions | `/api/invoices/{id}/actions` | Staff/admin |
| Payments | `/api/invoices/{id}/payments` | Staff/admin |
| Overdue | `/api/invoices/summary/overdue` | Staff/admin |
| Print | `/api/invoices/{id}/print` | Owner or staff/admin |

The login endpoint follows Swagger OAuth2 password flow: use the email in the `username` field and leave `client_id` and `client_secret` empty.

## Ownership and overlap handoff

### Member 1 — backend/core

Member 1 owns the database contract, auth, schemas, catalog behavior, validation, and the backend API contract. Do not rename model or schema fields without coordinating with the other members.

### Member 2 — engine review

The current branch contains `engine/pricing.py`, `engine/billing.py`, and `engine/state_machine.py` as backend implementations required for the API. Member 2 must review these modules and either adopt them or merge their own pricing/state-machine implementation without duplicating rules. In particular, verify:

- Fixed versus percentage discount semantics.
- Subscription-level versus product-level discount scope.
- Tax rounding behavior.
- Usage-count increments under concurrent billing.
- Pause/resume/renew/close transition rules.
- Whether plan price should be included in invoice totals.

### Member 4 — integration review

`main.py` and the API routers are currently wired so the backend can run independently. Member 4 must verify:

- Router inclusion and frontend base URL.
- CORS origin restrictions for the final frontend URL.
- Error response shapes.
- Authentication token storage and refresh behavior.
- API calls match the schemas in `core/schemas.py`.
- The frontend uses the customer ownership restrictions correctly.

### Member 3 — frontend review

The backend exposes the complete data flow but does not implement frontend screens. Member 3 must connect the UI to:

1. Login and role-aware navigation.
2. Catalog lists and admin forms.
3. Subscription creation and lifecycle buttons.
4. Invoice detail, printable output, payment recording, and overdue views.

## Verification

Run syntax and unit checks:

```powershell
python -m compileall -q backend
pytest -q
```

Run the read-only smoke test against a running local API:

```powershell
python scripts/backend_smoke_test.py
```

The smoke test checks health, login, `/me`, products, plans, taxes, discounts, templates, subscriptions, invoices, and overdue summaries. Set `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `SMOKE_ROLE`, or `SMOKE_BASE_URL` when using different local values. Run it once for each role; it expects customer-only `403` responses where appropriate. It does not create or modify business data.

Manual smoke flow in Swagger:

1. Login as admin and create a product, plan, tax, and discount.
2. Login as customer and create a subscription using those IDs.
3. Generate an invoice.
4. Confirm tax and discount totals.
5. Login as staff and confirm/cancel/send or print the invoice.
6. Record a partial payment and then the balance.
7. Test pause, resume, renew, and close according to the plan flags.
8. Confirm a customer cannot access another customer's subscription or invoice.

## Known handoff checks

- The API uses `create_all()` for hackathon bootstrap; replace it with Alembic migrations before production.
- Email sending is represented by a send-readiness response; an email provider is not coupled to this backend.
- Printable invoices are HTML responses intended for browser print/PDF conversion.
- Concurrency testing for invoice creation and discount usage still needs to be performed before production.
