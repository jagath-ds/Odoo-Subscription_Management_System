# Team guide — Brightloop frontend

A short, practical guide so any teammate can clone the repo, run it, and add a page or an API call
without guessing. Read this once; it takes about five minutes.

> **Full-stack setup** (PostgreSQL, FastAPI backend, seed data, demo logins, benchmark) is in the
> root [`README.md`](../README.md). This guide covers the frontend workflow and conventions.

---

## 1. What this repo contains

| Path | What it is | Owner |
| --- | --- | --- |
| `frontend/` | React + Vite app (this guide) | Member 3 |
| `backend/` | FastAPI API (`core/`, `engine/`, `services/`, `api/`) | Members 1, 2, 4 |
| `scripts/` | `init_db.py` (create/reset DB) and the end-to-end smoke test | Member 4 |
| `tests/` | Engine unit tests (pytest) | Member 2 |
| `docs/` | Problem statement, team blueprint, this guide | All |
| `setup.cmd` / `.ps1` / `.sh` | One-command full-stack install (venv, `.env` files, database, seed, npm) | Member 4 |

### Virtual Environments (`venv`), Dependencies & `.env`

To keep development clean, isolated, and secure across both frontend and backend teammates:

1. **Python Virtual Environment (`venv`)**:
   Backend dependencies are defined in root `requirements.txt`. Always work inside a virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\Activate.ps1    # Windows PowerShell
   venv\Scripts\activate.bat      # Windows CMD
   source venv/bin/activate       # macOS / Linux
   pip install -r requirements.txt
   ```
   Do **not** commit `venv/`, `.venv/`, or `__pycache__/` — the root `.gitignore` already excludes them.

2. **Frontend Isolated Dependencies (`node_modules`)**:
   The frontend uses `frontend/package.json` and `frontend/package-lock.json`. Running `npm install` installs packages into `frontend/node_modules/` (project-local, git-ignored).

3. **Environment Variables & Secrets (`.env`)**:
   Never put database passwords, secret keys, or private URLs in committed source code.
   - Copy `.env.example` to `.env` (root and `frontend/.env`).
   - `.env` files are ignored by git; `.env.example` provides safe templates for teammates.

---

## 2. First-time setup

**Prerequisites:** Node.js **22 LTS or newer**, Python **3.11+**, PostgreSQL **15+**.

Run the setup script from the repository root. It creates `venv`, installs `requirements.txt`,
copies both `.env.example` files, initialises the database, seeds demo data and runs `npm install`:

```bat
setup.cmd
```

```bash
./setup.sh
```

Then start both servers (two terminals, from the repository root):

```bash
venv\Scripts\python -m uvicorn backend.main:app --reload --port 8000   # Windows
venv/bin/python -m uvicorn backend.main:app --reload --port 8000       # macOS / Linux

cd frontend && npm run dev                                              # http://localhost:5173
```

Frontend-only alternative (offline mock data, no backend needed): set `VITE_USE_MOCK=true` in
`frontend/.env`, then `cd frontend && npm install && npm run dev`.

Demo logins (live backend): `admin@brightloop.local`, `staff@brightloop.local`,
`customer@brightloop.local`, all with password `Brightloop@123`.

---

## 3. Everyday commands (run in `frontend/`)

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check + production build (must pass before a PR) |
| `npm run preview` | Serve the built app locally |
| `npm run lint` | oxlint |

---

## 4. Folder map

```
frontend/src/
├─ components/
│  ├─ layout/     AppShell, Sidebar, Topbar, CommandPalette, RoleSwitcher…
│  ├─ auth/       AuthLayout, PasswordChecklist, ForgotPasswordDialog
│  ├─ common/     PageHeader, EmptyState, PhasePlaceholder
│  ├─ finance/    KpiCard
│  └─ ui/         shadcn/Base UI primitives (generated, avoid hand-editing)
├─ pages/         one file per surface (DashboardPage, auth/, catalog.tsx…)
├─ mocks/         fixtures, in-memory db, reducer/store, mock adapter
├─ services/      api.ts (the ONLY data entry point), live.adapter.ts, types.ts
├─ lib/           format.ts (INR, dates), validation.ts, utils.ts (cn)
└─ types/         contracts.ts (shared API types), nav.ts (menu + role rules)
```

---

## 5. Environment variables

`frontend/.env` (copy from `.env.example`, never commit it):

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | FastAPI backend base URL (no trailing slash) |
| `VITE_USE_MOCK` | `false` | `false` = live FastAPI backend, `true` = in-memory demo data (offline) |

The frontend origin (`http://localhost:5173`) must be listed in `CORS_ORIGINS` in the root `.env`.

Rules:

* **Never hardcode URLs, keys or tokens in source.** Add a `VITE_*` variable, declare it in
  `src/vite-env.d.ts`, and read it with `import.meta.env`.
* Commit `.env.example` with safe placeholders; commit `.env` never.
* Anything secret belongs in the backend, not in a `VITE_` variable — Vite bakes those into the
  bundle and every visitor can read them.

---

## 6. How to add a page (example)

Say you are adding **"Credit Notes"** at `/credit-notes`.

**Step 1 — create the page** `frontend/src/pages/CreditNotesPage.tsx`:

```tsx
import { ReceiptText } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'

export function CreditNotesPage() {
  return (
    <div>
      <PageHeader
        title="Credit Notes"
        description="Credits issued against invoices, with the reason and the amount."
      />
      <EmptyState
        icon={ReceiptText}
        title="No credit notes yet"
        message="Credit notes created from an invoice will appear here."
      />
    </div>
  )
}
```

**Step 2 — register the route** in `frontend/src/App.tsx`:

```tsx
<Route
  path="credit-notes"
  element={
    <RequireRole allow={INTERNAL}>
      <CreditNotesPage />
    </RequireRole>
  }
/>
```

**Step 3 — add the menu entry** in `frontend/src/types/nav.ts`:

```ts
{
  label: 'Credit Notes',
  to: '/credit-notes',
  icon: ReceiptText,
  roles: INTERNAL,
  description: 'Credits issued against invoices',
}
```

The sidebar, mobile drawer and `Ctrl+K` palette all read from `NAV_GROUPS`, so the page shows up
everywhere at once. `RequireRole` uses the same `roles` list — keep them consistent.

---

## 7. How to add data (the four-step pattern)

Components **never** import mocks. They call `services/api.ts`, which picks mock or live.

**Step 1 — add the type** to `src/types/contracts.ts`:

```ts
export interface CreditNote {
  id: number
  invoice_id: number
  amount: number
  reason: string
  created_at: DateStr
}
```

**Step 2 — add the mock** in `src/mocks/mock.adapter.ts`:

```ts
export async function listCreditNotes(): Promise<CreditNote[]> {
  return db.creditNotes.map((note) => ({ ...note }))
}
```

**Step 3 — expose it** in `src/services/api.ts`:

```ts
export function listCreditNotes(): Promise<CreditNote[]> {
  return route(() => mock.listCreditNotes(), () => live.listCreditNotes())
}
```

**Step 4 — add the live stub** in `src/services/live.adapter.ts`:

```ts
export async function listCreditNotes(): Promise<CreditNote[]> {
  return request<CreditNote[]>('/api/credit-notes')
}
```

Now the UI can call `listCreditNotes()` and it works in both modes. When the backend is ready,
only step 4 changes.

---

## 8. Conventions checklist

* **TypeScript strict** — no `any`, no unused variables (`npm run build` catches both).
* **Money** — format with `formatCurrency()` from `lib/format.ts` (INR, `en-IN`, 2 decimals).
* **Dates** — always `YYYY-MM-DD` strings in data and APIs; format for display only.
* **Components call `services/api.ts`** — never `mocks/` directly.
* **Every screen has states** — loading, empty, success, and an error message.
* **No dead UI** — every button either works or is disabled with a tooltip saying which phase it lands in.
* **Role checks** — add the route to `RequireRole` *and* to `nav.ts` with the same roles.
* **Responsive** — test at 390px wide; grids need `grid-cols-1` before `sm:grid-cols-*`.
* **Problem-statement wording** — plans, subscriptions, billing day, invoices, payments, discounts.

---

## 9. Git workflow for the team

```bash
git clone <repo-url>
git checkout main
git pull

git checkout -b feature/credit-notes
# ...work...
npm run build
git add -A
git commit -m "feat(frontend): credit notes list"
git push -u origin feature/credit-notes
```

* `main` holds the integrated, working full stack; `test/integration` is the staging branch.
  `backend`, `features` and `front-end` are kept as the original per-member branches.
* One feature per branch, small commits, `npm run build` green before pushing.
* Never commit `node_modules/`, `dist/`, `.env`, `frontend/.env`, `venv/`, or editor folders.

---

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `npm ci` fails after pulling | `rm -rf node_modules package-lock.json && npm install` |
| Port 5173 in use | `npm run dev -- --port 5174`, and add `http://localhost:5174` to `CORS_ORIGINS` in the root `.env` |
| "Could not reach the Brightloop API" | Start the backend on port 8000 and check `VITE_API_BASE_URL` in `frontend/.env` |
| Blank page / odd data (mock mode) | Account menu → **Reset demo data**, or clear `sessionStorage` |
| Messy live data | `python scripts/init_db.py --reset` then `python -m backend.seed` (root, inside `venv`) |
| "VITE_API_BASE_URL is not set" | Add the URL to `frontend/.env` and restart `npm run dev` |
| Node version errors | Install Node 22 LTS; Vite 8 and `cn` require it |
| Menu item missing | Check `roles` in `src/types/nav.ts` for the signed-in role |
