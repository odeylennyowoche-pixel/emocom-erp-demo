# EMOCOM ERP — Demo for EMOCOM Technologies and Consulting Ltd

A frontend **demonstration prototype** of a modular ERP for EMOCOM (IT, communications and digital-transformation services):
employees, inventory & assets, procurement with approvals, finance, reports and settings — with **a separate login for every person**
and access limited by role and department. All people, clients and figures are **fictional**. Data lives only in the browser (localStorage).

## Demo logins

Password for every account: `emocom2026` (shown on the login page; demo only, not real security).

| Username | Who | Sees |
| --- | --- | --- |
| `ceo` | Managing Director & CEO | Everything; approves any request |
| `admin` | ERP & Systems Administrator | Everything; manages users & settings; no approvals |
| `hod.finance` | Head of Finance | Company finance, budgets, all reports; approves any dept ≤ ₦20m |
| `hod.hr` | Head of HR & Admin | All staff records (manage); own dept spend; approves HR requests ≤ ₦5m |
| `hod.procurement` | Head of Procurement & Logistics | All stock, suppliers, requests, receiving; approves own dept ≤ ₦5m |
| `hod.sales` | Head of Sales & BD | Sales team, client invoices, own dept spend; approves Sales ≤ ₦5m |
| `hod.engineering`, `hod.services`, `hod.projects` | Other heads | Own team, requests, spend and reports; approve own dept ≤ ₦5m |
| `staff.<dept>` (sales, engineering, services, projects, finance, hr, procurement) | Staff | Own profile, own requests, stock availability, plus their department's work (e.g. Finance staff record expenses; HR staff maintain records) |

Try: sign in as `staff.sales` and raise a request → sign in as `hod.sales` and approve it → sign in as `staff.procurement` and mark it received.

## Sharing the demo

The site is static and uses hash URLs (`/#/employees`), so it can be hosted anywhere. A GitHub Actions workflow
(`.github/workflows/deploy.yml`) builds and publishes it to GitHub Pages on every push to `main`.

> This is not a production ERP. There is no backend, no real authentication, no accounting engine and no payments.

## Run it

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev        # http://localhost:5180
```

Other commands:

```bash
npm run build      # type-check (tsc -b) + production build into dist/
npm run preview    # serve the production build (http://localhost:4180)
npm run typecheck  # TypeScript only
```

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router · Recharts · Lucide icons · React Hook Form + Zod.
No global state library — a small context store (`src/data`) holds the demo state.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Executive dashboard — KPIs, revenue vs expenses, spend by department, transactions, items needing attention, headcount, activity. Date-range filter (`?range=`). |
| `/employees` | Directory with search, department/status/type filters, sorting, pagination, CSV export |
| `/employees/new`, `/employees/:id`, `/employees/:id/edit` | Add (validated), detail (assets, requests, status changes, delete with safeguards), edit |
| `/inventory` | Tabs: stock items, assets register (add/edit modal), stock movements |
| `/inventory/items/new`, `/inventory/items/:id`, `/inventory/items/:id/edit` | Item form, item detail with receive / issue / stock-count, balance chart, movement history |
| `/procurement` | Tabs: purchase requests (status pipeline, filters, export) and suppliers (add/edit) |
| `/procurement/requests/new`, `/procurement/requests/:id`, `/procurement/requests/:id/edit` | Multi-line request form, detail with approval workflow, history, print |
| `/finance` | Tabs: overview & budgets, expenses (record / mark paid), invoices, transactions |
| `/finance/invoices/:id` | Printable invoice with status actions |
| `/reports` | Employee, inventory, procurement and expense summaries; date range; CSV export; print |
| `/login` | Sign-in with per-person demo accounts |
| `/settings` | Organisation profile, departments, user accounts & access levels, access matrix, appearance, demo-data reset (CEO/admin only) |
| `/search?q=` | Global search results (also Ctrl+K from anywhere) |

## Key workflows

- **Purchase request**: Draft → Pending Approval → Approved → Received (or Rejected → revise as Draft).
  Invalid or repeated transitions are blocked. Every change writes history, an activity entry and a notification.
  On **Received**, linked inventory items are restocked (stock movement recorded) and a pending Procurement expense is created in Finance.
- **Access control** (`src/features/auth/permissions.ts`): one matrix decides modules, record scope (company / department / own) and actions per access level and department.
- **Demo approval rules**: Head of Department ≤ ₦5m (own department), Head of Finance ≤ ₦20m (any), CEO unlimited; nobody approves their own request.
- **Inventory**: receive / issue / count adjustments with validation (no negative stock); low-stock notifications.
- **Finance**: expense recording, mark paid, invoice sent/paid/overdue. Transactions are a derived view of paid invoices and paid expenses.

## Project structure

```
src/
  app/            App, router, error pages
  config/app.ts   Product name, currency (NGN), locale, storage version
  components/     UI kit (Button, Badge, Card, Form, Modal, DataTable, Tabs, Toast…) and chart helpers
  layouts/        App shell: sidebar, top bar, breadcrumbs, global search, notifications, profile menu
  features/       dashboard, employees, inventory, procurement, finance, reports, settings, search
  data/           seed data (deterministic), storage (versioned localStorage), pure actions, selectors, provider
  hooks/          useAction (feedback), useQueryState (URL filters), usePopover
  lib/            money (integer kobo arithmetic), dates, csv, utils
  types/          Business entity types
```

### Data & consistency

- One typed, related dataset (`src/data/seed.ts`) — departments, 86 employees, suppliers, 33 stock items with movement history, assets, purchase requests, 14 months of expenses and invoices.
- Every page reads figures through `src/data/selectors.ts`, so dashboard, modules and reports always agree.
- Money is stored as **integer minor units** (kobo) and never multiplied as floats.
- Storage key is versioned (`enterpriseone.demo-state.v1`); malformed data is detected and re-seeded; **Settings → Demo data → Reset** restores the original dataset.
- `src/data/actions.ts` contains pure state transitions — each maps naturally to a future API endpoint.

## Known limitations

- Single-browser, single-user persistence; no sync, backups or multi-user concurrency.
- Logins and permissions run in the browser — a demonstration, **not** secure authentication or authorisation. All accounts share one demo password.
- Everyone using the same browser shares the same demo data (useful for showing approvals moving between people).
- No real authentication, audit log integrity, tax, double-entry accounting, payments or bank integration.
- Currency is display-configurable in `src/config/app.ts`; amounts are not converted.
- Invoices cannot be created in the UI yet (status changes only).
- Charts and fonts load from the bundle; the Inter font uses Google Fonts when online and falls back to system fonts offline.

## Production roadmap (not implemented)

Backend API · database & migrations · authentication and server-enforced permissions · audit logging ·
transaction integrity · backup & recovery · data protection & deployment hardening · integration and E2E tests ·
organisation-specific business rules (approval matrix, chart of accounts, tax).
