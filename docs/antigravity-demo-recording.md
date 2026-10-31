# Antigravity task: record the BrightLoop demo video

You are recording a ≤ 5-minute product demo of the BrightLoop Subscription ERP, following
`docs/Project Demo Video Flow and Script.pdf`. Drive the browser exactly as written below and
record each scene as its own browser recording. Move slowly and deliberately: after every
click that changes a status, **wait 2 seconds** so viewers can read the new state.

---

## 0. Setup (do this before recording, do not record it)

Run in a terminal at the repository root (Windows PowerShell):

```powershell
# 1. Free ports 8000/5173 if something is already running there
Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 2. Fresh demo data
venv\Scripts\python scripts\init_db.py --reset
venv\Scripts\python -m backend.seed
```

Start the servers in **two separate terminals** and keep them running (the backend terminal
must stay visible: the password-reset link is printed there in Scene 1):

```powershell
venv\Scripts\python -m uvicorn backend.main:app --port 8000      # terminal 1 (backend)
cd frontend; npm run dev                                           # terminal 2 (frontend)
```

Check: <http://127.0.0.1:8000/api/health> returns `{"status":"ok"}` and
<http://localhost:5173> shows the sign-in page.

Browser: 1920×1080 window, zoom 100%, light theme. Always use `http://localhost:5173`
(not 127.0.0.1). Each browser **tab** keeps its own login, so use three tabs:

| Tab | Role | Email | Password |
|---|---|---|---|
| A | ADMIN | `admin@brightloop.local` | `Brightloop@123` |
| B | STAFF | `staff@brightloop.local` | `Brightloop@123` |
| C | CUSTOMER | `customer@brightloop.local` (Acme Retail Pvt Ltd) | `Brightloop@123` |

Do **not** click: any Delete icon, the invoice **Cancel** button (opens a native confirm
dialog), the role switcher, or "Reset demo data".

---

## Scene 1 — Access control (0:00–0:50)

Tab A, signed out, at `http://localhost:5173/signup`.

1. Full name `Riya Kapoor`, Work email `customer@brightloop.local`, Password `Brightloop@2026`,
   Confirm password `Brightloop@2026` → **Create account**. Show the error *"Email is already registered"*.
2. Change Work email to `riya.kapoor@example.com`. Change Password to `Short@1a`: point at the
   red password checklist (needs **more than 8 characters**); the button stays disabled.
3. Set Password and Confirm password to `Brightloop@2026` → checklist all green → **Create account**.
   You land on the customer portal as Riya (CUSTOMER).
4. Sign out (account menu, top right). On the sign-in page click **Forgot password?**, enter
   `riya.kapoor@example.com`, submit → *"Reset link sent"*. Switch to the backend terminal and
   show the line `[password-reset] riya.kapoor@example.com -> http://localhost:5173/reset-password?token=…`.
5. Sign in as **ADMIN** (`admin@brightloop.local` / `Brightloop@123`). Sidebar → **Team → Staff Members**
   → **Add Staff Member**: Full Name `Rahul Sharma`, Work Email `rahul.sharma@brightloop.local`,
   Temporary Password `Welcome@2026`, Access Role **Staff (Operations & Quotations)** → save.
   Show Rahul in the list.

## Scene 2 — Catalog, plans, taxes & discounts (0:50–1:55)

Tab A (Admin).

1. **Catalog & Rules → Products & Variants → New product**: Product name `Brightloop HR Suite`,
   Type **Service**, Sales price `1800`, Cost price `450`, Notes `Payroll and attendance seats`, Active → save.
2. On that product click **Add variant**: Attribute `Brand`, Value `Odoo`, Price extra `560` → save.
   Show the **+560** badge. Also show the existing *Brightloop Cloud ERP* with its Odoo +560 variant.
3. **Plans → New plan**: Plan name `Growth Monthly`, Billing frequency **Monthly**, Plan price `1500`,
   Minimum quantity `1`, Available from = today, Available until = 31 Dec of this year.
   Toggle **Auto close** on, **Early close** on, **Pause** on, **Renew** on → save.
   Point at *Annual Enterprise Plan* (yearly, min 5, Early close **off**).
4. **Tax Rules**: show *GST 18%* (18%).
5. **Discount Rules → New discount rule**: Discount name `15% Off 25+ Seats`, Type **Percentage**,
   value `15`, Scope **Product line**, Minimum quantity `25`, Minimum purchase `0`,
   Valid from = today, Valid until = 31 Dec, Maximum uses `20` → save.
   Point at the existing *10% Off for >=10 seats* (min qty 10, max 50 uses).

## Scene 3 — Quote to active subscription (1:55–2:55)

Tab B: sign in as **STAFF** (`staff@brightloop.local` / `Brightloop@123`).

1. Sidebar → **Quotations**. Choose template **Enterprise Annual Offer** (plan and lines pre-fill).
   Choose customer **Acme Retail Pvt Ltd**.
2. On the *Brightloop Cloud ERP* line keep variant **Brand: Odoo** (unit price 2,560 = 2,000 + 560)
   and change Quantity to `12`. Point at the 10% discount, 18% GST and the totals updating.
   Payment terms **Net 30 Days**.
3. Click **Create Quotation**. The subscription page opens in **DRAFT**: point at the subscription
   number, customer, plan, start date, expiry date, payment terms and the line table.
4. Click **Submit Quotation** → QUOTATION (wait 2 s) → **Confirm Order** → CONFIRMED (wait 2 s)
   → **Activate Subscription** → ACTIVE (wait 2 s). Point at the status ribbon each time.
   Note the subscription number (`SUB-…`) for Scene 4.

Expected grand total for this quote: **₹32,978.64**
(12 × 2,560 = 30,720 − 10% = 27,648 + 18% GST 4,976.64; WhatsApp add-on 300 + 54).

## Scene 4 — Billing day, payments & customer portal (2:55–4:00)

Tab B (Staff).

1. Sidebar → **Billing Day**. Leave the date as today → **Run Billing Day Batch**. Point at the
   result rows: **BILL** for the new subscription (and SUB-DEMO-0005), **AUTO_CLOSE** for SUB-DEMO-0006.
2. Click **Run Billing Day Batch** again: nothing is billed twice (no new BILL rows for them).
3. Sidebar → **Invoices**, search the new `SUB-…` number → **View**. The invoice is **DRAFT** with
   customer, lines, 10% discount and GST filled in.
4. **Confirm Invoice** → CONFIRMED. **Send to Customer** (toast). **Print / PDF** → when the print
   dialog opens, wait 2 s and press **Escape**.
5. **Record Payment**: Payment Method **UPI**, Amount `15000`, Payment Date today,
   Note `UPI ref ACME-0001` → save → **PARTIALLY_PAID**.
6. **Record Payment** again: Method **Bank Transfer**, Amount = remaining `17978.64`,
   Note `NEFT final` → save → **PAID**, amount due 0.

Tab C: sign in as **CUSTOMER** (`customer@brightloop.local` / `Brightloop@123`).

7. **My Subscriptions**: point out only Acme's subscriptions are visible. On the new subscription
   click **View Contract Details**. Toggle the **WhatsApp Automated Alerts** add-on off, then on
   (total changes by ₹354). Click **Pause Subscription** → PAUSED, then **Resume Subscription** → ACTIVE.
8. **My Invoices** → the paid invoice → **View / Print**. Show it is PAID.

## Between Scene 4 and Scene 5 (do not record)

Load thousands of subscriptions and invoices so Scene 5 proves the < 2 s requirement
(takes about 5 seconds; the backend must be running):

```powershell
venv\Scripts\python -m backend.seed_benchmark --subs 5000
```

It must end with `ALL ENDPOINTS UNDER 2 SECONDS`. Then refresh tab A.

## Scene 5 — Month-end finance review (4:00–4:45)

Tab A (Admin).

1. Sidebar → **Finance Dashboard**. Hover over the four KPIs: Active Subscriptions, MRR Collected,
   Total Outstanding, Overdue Invoices. Point at the query-time badge (milliseconds, with
   thousands of subscriptions loaded).
2. Point at the overdue chase table (days overdue). Sidebar → **Invoices**, filter to overdue
   invoices; refresh once to show it loads instantly.
3. Sidebar → **Subscriptions**, search `SUB-DEMO-0001` → open it → **Close Early** → **CLOSED**
   (wait 2 s on the ribbon). End the recording.

---

## Recording rules

* One recording per scene; name them `scene-1-access` … `scene-5-finance`. Stay within each scene's time.
* Cursor moves slowly; never scroll fast; wait 2 s after every status change.
* If a step fails, stop that scene's recording, report the exact error text, and do not improvise
  data changes. To start over: stop the backend, run `scripts\init_db.py --reset`,
  `backend.seed` (and `seed_benchmark`), restart the backend.
* After recording, report: the 5 recording files, the new `SUB-…` and `INV-…` numbers, and
  anything that looked wrong on screen.
