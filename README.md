# Brightloop — Subscription Management System

Frontend for the Brightloop Software subscription platform: plans, quotations, subscriptions,
recurring billing, invoices, payments, discount rules and a customer self-service portal.

Built by **Member 3 (Frontend)** for the hackathon. This repository contains **source code only** —
dependencies are installed on your machine by the setup scripts below.

---

## Phase status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Blueprint & contracts (`docs/Phase-1-Blueprint.pdf`) | Done |
| 2 | App shell, authentication, role-aware navigation, routing | **Done** |
| 3 | Catalog & rules studio, subscriptions, quotations, team | **Done** |
| 4 | Billing Day simulator, invoices, payments, customer portal | **Done** |
| 5 | Finance command dashboard, Recharts analytics, what-if calculator, SLA badge | **Done** |

Every navigation entry resolves to a real page: completed surfaces render live mock data,
upcoming surfaces render a phase-badged placeholder that describes what lands there.

---

## Quick start

### Windows (recommended)

Double-click **`setup.cmd`** — it checks Node.js, installs dependencies, creates `.env`
and starts the dev server.

Or from a terminal:

```bat
setup.cmd
```

### macOS / Linux

```bash
chmod +x setup.sh
./setup.sh
```

### Manual

```bash
cd frontend
npm install
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
npm run dev
```

The app runs at **http://127.0.0.1:5173**.

**Prerequisites:** Node.js **22 LTS or newer** (Vite 8 + the `cn` class-merge package require it)
and npm 10+. Check with `node -v`.

### Sharing with teammates

* **No Python venv here.** This is a Node app: dependencies install into `frontend/node_modules`
  (project-local, git-ignored) when you run `setup.cmd`. Nothing is installed globally.
* **No `requirements.txt` here.** The equivalents are `frontend/package.json` (what we depend on)
  and `frontend/package-lock.json` (exact pinned versions, used by `npm ci`). The Python backend
  will carry its own `.venv` and `backend/requirements.txt` when it is added to this repo.
* Read **[docs/TEAM-GUIDE.md](docs/TEAM-GUIDE.md)** for a folder map, how to add a page, how to add
  an API call, conventions, git workflow and troubleshooting.

---

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin (Finance Lead) | `admin@brightloop.in` | `Brightloop#2026` |
| Staff | `staff@brightloop.in` | `Brightloop#2026` |
| Customer | `customer@brightloop.in` | `Brightloop#2026` |

The login screen also has one-click demo buttons for each role, and the top bar has a
**role switcher** so reviewers can see every permission boundary without signing out.
Sign-ups always create a `CUSTOMER` account and land on the self-service portal.

The demo clock is pinned to `2026-10-31` so seeded renewals and overdue invoices stay meaningful.

---

## Data source: mock → live backend

`frontend/src/services/api.ts` is the only seam between UI and data.

```env
# frontend/.env
VITE_USE_MOCK=true                     # default: in-memory mock store
VITE_API_BASE_URL=http://localhost:8000 # used when VITE_USE_MOCK=false
```

* `USE_MOCK = true` → `mocks/mock.adapter.ts` (seeded store, instant, no network).
* `USE_MOCK = false` → `services/live.adapter.ts`, a typed `fetch` stub. Replace each stub body
  with the matching FastAPI endpoint; the function signatures already match `types/contracts.ts`.

Components never import mock data directly — they call `services/api.ts` only.

---

## Tech stack

* **React 18** + **Vite 8** + **TypeScript 7** (strict, no `any`)
* **Tailwind CSS v4** + `tw-animate-css`, **shadcn/ui** on Base UI primitives
* **lucide-react** icons, **Recharts** charts (Phase 5), **next-themes** (dark default)
* **date-fns** dates (`YYYY-MM-DD` everywhere), **TanStack Table** + **react-window** (Phase 4/5)
* **sonner** toasts, **cmdk** command palette (`Ctrl/Cmd + K`)

Money is formatted with `Intl.NumberFormat('en-IN')` (INR, 2 decimals, half-up rounding at line level).

---

## Project structure

```
brightloop/
├─ docs/                     Phase 1 blueprint (HTML + PDF)
├─ setup.cmd / .ps1 / .sh    One-command dependency install + dev server
├─ frontend/
│  ├─ src/
│  │  ├─ components/         layout shell, auth, finance widgets, ui/ primitives
│  │  ├─ pages/              dashboard, auth, catalog, portal, placeholders, errors
│  │  ├─ mocks/              fixtures, in-memory db, reducer/store, mock adapter
│  │  ├─ services/           api.ts (USE_MOCK seam), live adapter, api errors
│  │  ├─ lib/                formatting, validation, cn helper
│  │  └─ types/              contracts.ts, nav.ts
│  ├─ .env.example
│  └─ package.json
└─ README.md
```

---

## Scripts

Run inside `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |

---

## Phase 2 coverage

* Dark-first emerald theme, responsive shell: sidebar collapses to a drawer under `lg`.
* Login, sign-up with live password checklist, forgot-password dialog (mock send).
* Role-aware sidebar + top bar, `RequireAuth` / `RequireRole` route guards, 403 and 404 pages.
* Session persists across reloads (`sessionStorage`), sign-out and demo reset clear it.
* Command palette, notification popover with unread badge, theme toggle, role switcher.
* Dashboard preview KPIs (clearly badged **Preview data**); analytics arrive in Phase 5.

---

## Phase 3 coverage (in progress)

### Admin Catalog & Rules Studio — done

* **Products & Variants** — CRUD, `SERVICE` / `ADDON`, base and cost price, price-extra
  variants (e.g. Brand: Enterprise **+₹560**), active toggle, expandable variant rows.
* **Plans** — billing frequency, plan price, minimum quantity, availability window and
  the four permission toggles (`auto_close`, `can_close_early`, `can_pause`, `can_renew`).
* **Tax Rules** — rate with active state; edits never rewrite issued invoice snapshots.
* **Discount Rules** — percent / fixed, product / subscription scope, minimum quantity,
  minimum purchase, validity window, usage limit and a derived Active / Scheduled /
  Expired / Exhausted state.
* **Quotation Templates** — plan, quote validity and a multi-line product / variant editor.
* Shared `DataTable`, `FormDialog`, `Field` and `ListToolbar` primitives with loading,
  empty and error states; tables scroll horizontally on mobile without page overflow.
* Referential guards: products or plans used by a quotation template cannot be deleted.
* All catalog calls go through `services/api.ts`; the mock store is seeded with 6 products,
  7 variants, 6 plans, 5 tax rules, 5 discount rules and 4 templates.

### Subscriptions, Quotations & Team ERP — done

* **Subscriptions List & Detail** — Contract A view with status ribbon, customer details,
  dates, and plan permissions.
* **Mirrored Business Engine** — framework-free calculation (`lineItem.ts`) with half-up
  paise rounding, gross/discount/GST math, and calendar date transitions (`transitions.ts`).
* **Interactive Chevron Ribbon** — Odoo-style pipeline: `DRAFT` → `QUOTATION` → `CONFIRMED`
  → `ACTIVE` → `PAUSED` / `CLOSED`.
* **Plan-Flag Gated Actions** — Pause, Early Close, and Renew buttons dynamically disabled
  with descriptive tooltips (e.g. *"This plan does not allow early closure"*) based on plan rules.
* **Pause Date Shift** — Resuming a paused subscription computes days paused and shifts
  both `next_billing_date` and `expiry_date` forward by the exact duration.
* **Create from Quotation Template** — 1-click template selection pre-populates plan and
  product lines, provides interactive quantity/variant adjustments with live pricing
  recalculation, and converts to a confirmed subscription.
* **Add-on Module Toggling** — Optional add-ons (e.g. WhatsApp Alerts) can be toggled on or
  off per subscription.
* **Staff Team Page** — Admin-only staff member list with modal dialog enforcing email
  uniqueness and the 9+ character password policy.

---

## Phase 4 coverage — done

* **Billing Day Time-Travel Simulator** (`/billing`) — Global date-travel clock (`today`) driving
  dynamic overdue and billing batch evaluations.
* **Batch Execution Pipeline** — 5-stage animated batch pipeline (*Due subscriptions identified →
  Discount windows checked → GST computed → Snapshots created → Ledger updated*).
* **Double-Billing Idempotency Guard** — Subscriptions keyed by `{sub_number}:{next_billing_date}`.
  Running the batch again skips already-billed subscriptions (*"nothing billed twice"*).
* **Batch Run Audit Ledger** — Auditable table of all decisions (`BILL`, `SKIP`, `AUTO_CLOSE`).
* **Invoices & Receivables** (`/invoices`) — Search, overdue filters, status tracking, and quick chase actions.
* **Printable Invoice Document** (`/invoices/:id`) — Contract B representation, snapshot immutability
  guarantee, dedicated `@media print` layout, and payment history ledger.
* **Payment Modal & Transactions** (`/payments`) — Record payments via UPI, NEFT Bank Transfer, Card,
  and Cash. Enforces overpayment refusal and `CONFIRMED` → `PARTIALLY_PAID` → `PAID` state transitions.
* **Customer Self-Service Portal** (`/portal` & `/portal/invoices`) — Role-isolated portal where customers
  manage their own subscriptions, toggle add-on services, and download invoices.

---

## Phase 5 coverage — done

* **Finance Lead Dashboard** (`/dashboard`) — 4 core KPI cards (Active Subscriptions, MRR Collected,
  Total Outstanding, Overdue Invoices) with targets and trends.
* **Sub-2s SLA Speed Badge** — Real-time selector measurement (`⚡ Query Time: <50ms`) proving sub-second
  speed to hackathon evaluators.
* **Recharts Visualizations**:
  1. *MRR vs Outstanding* — Dual-series area chart across 12 simulated periods.
  2. *Revenue Collected vs Outstanding by Frequency* — Stacked bar chart (Daily, Weekly, Monthly, Yearly).
  3. *Invoice Status Mix* — Interactive donut chart across 6,000 invoices.
  4. *Renewals Due Next 30 Days* — Horizontal bar chart by timeline window.
* **What-If Revenue Calculator** — Interactive seat quantity slider (1–150 seats), plan & brand variant select,
  10% discount toggle, and GST 18% calculation projecting live MRR contribution.
* **AI Revenue Insights Panel** — 1.5s simulated heuristic analysis with actionable alerts (discounts, renewals,
  and overdue chase) with one-click Apply actions.
* **Overdue Receivables Chase Table** — Prioritized debt list with days overdue severity pills and
  direct "Chase Reminder" and "Record Payment" shortcuts.
