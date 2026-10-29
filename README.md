# EMOCOM ERP — Demo for EMOCOM Technologies and Consulting Ltd

A frontend **demonstration prototype** of a modular ERP for EMOCOM (IT, communications and digital-transformation services):
employees, inventory & assets, procurement with approvals, finance, reports and settings — with **a separate login for every person**
and access limited by role and department. All people, clients and figures are **fictional**. Data lives only in the browser (localStorage).

## Demo logins

Password for every account: `emocom2026` (shown on the login page; demo only, not real security).
Account types follow EMOCOM's agreed structure.

| Username | Account type | Works with |
| --- | --- | --- |
| `ceo` | CEO / MD — main admin | Executive dashboards (revenue, gross margin, staff, pipeline, cash flow, OEM partners, inventory/assets, projects); final approvals; read-only elsewhere |
| `admin` | Secondary admin | Partner & OEM registry, sales contacts, vendors & subcontractors, licences, IT asset register, user accounts, integrations (simulated), audit log, backups, security policies |
| `finance.manager`, `finance.accountant` | Finance | Ledger & trial balance, receivables, payables, revenue recognition, period close, cash flow, payroll, requisition → PO → GRN. The manager approves purchases ≤ ₦20m and closes periods |
| `hr.manager` | HR | Employee master data, recruitment, on/offboarding, leave & attendance, KPIs & appraisals, learning & certifications |
| `sales.exec`, `sales.bd` | Sales | CRM (leads, contacts, clients), pipeline, client invoices & payment status, forecast & win/loss, won-deal handover, RFQ / tender / EOI, proposals |
| `manager.sales`, `manager.engineering`, `manager.services`, `manager.projects` | Manager (HOD) | Team projects, task allocation, milestones, change requests, status reports, team leave & claims, utilisation, appraisals, IT assets |
| `staff.presales`, `staff.engineering`, `staff.services`, `staff.projects` | Staff | Own tasks, project calendar, timesheets, leave & claims, payslip/tax/pension/HMO, skills & certifications, proposals & quotations — own data only |

**Demo approval limits:** managers approve their team's purchases up to ₦5m and change requests up to ₦10m; the finance manager approves purchases up to ₦20m;
the CEO gives final approval above that (capital) and for projects or contracts over ₦50m. Leave and claims go to the employee's manager (leave can also be approved by HR).
Nobody approves their own request.

Try: `sales.exec` hands over a won deal → `manager.projects` accepts it → `ceo` approves the project; or `staff.engineering` completes a task and requests leave → `manager.engineering` approves.

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
| `/` | Dashboard for the signed-in account type (CEO, admin, finance, sales, HR, manager or staff) |
| `/approvals` | One inbox for purchases & capital, projects & contracts, change requests, leave and expense claims |
| `/workspace` | My tasks & milestone tracker, project calendar, timesheets, leave & claims, pay & benefits, skills & certifications |
| `/proposals`, `/proposals/:id` | Proposal / quotation builder with line items and a milestone tracker |
| `/sales` | Pipeline board, leads, clients & contacts, RFQ / tender / EOI register, forecast & win/loss, handover, client invoices |
| `/projects`, `/projects/:id` | Projects overview; project detail with tasks, milestones, team utilisation, change requests and status reports |
| `/team` | Team performance & utilisation, appraisals, IT asset register |
| `/hr` | Master data summary, recruitment pipeline, on/offboarding checklists, leave & attendance, performance, learning |
| `/finance` | Overview & budgets, cash flow, general ledger, receivables, payables, revenue recognition, payroll, purchasing, period close |
| `/admin` | Partners & OEMs, sales contacts, vendors & subcontractors, licences, IT assets, user accounts, integrations, audit log, backups, security |
| `/employees`, `/inventory`, `/procurement`, `/reports`, `/settings` | Employee records, stock & assets, requisitions, reports with CSV export, organisation settings |
| `/login` | Sign-in with per-person demo accounts |

## Key workflows

- **Purchase request**: Draft → Pending Approval → Approved → Received (or Rejected → revise as Draft).
  Invalid or repeated transitions are blocked. Every change writes history, an activity entry and a notification.
  On **Received**, linked inventory items are restocked (stock movement recorded) and a pending Procurement expense is created in Finance.
- **Access control** (`src/features/auth/permissions.ts`): one matrix decides modules, record scope (company / department / own) and actions per account type and department.
- **Approvals** (`src/config/approvals.ts`, `src/features/approvals/rules.ts`): demo limits above; every decision is logged and notifies the requester.
- **Won deal → project**: sales hands over, a delivery manager accepts (project created), projects over ₦50m wait for the CEO.
- **Finance views** (`src/data/workSelectors.ts`) are illustrative summaries of demo data: cash flow, ledger, aging, percentage-of-completion revenue, payroll with pension at 8% / 10% and a flat illustrative tax line (not PAYE).
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

- One typed, related dataset (`src/data/seed.ts`, `src/data/seedWork.ts`) — departments, 79 employees, suppliers & subcontractors, stock and assets, purchase requests, 14 months of expenses and invoices, plus partners, CRM, tenders, proposals, projects, tasks, timesheets, leave, claims, appraisals, certifications, licences and integrations.
- Every page reads figures through `src/data/selectors.ts`, so dashboard, modules and reports always agree.
- Money is stored as **integer minor units** (kobo) and never multiplied as floats.
- Storage key is versioned (`emocom-erp.demo-state.v4`); malformed data is detected and re-seeded; **Settings → Demo data → Reset** restores the original dataset.
- `src/data/actions.ts` contains pure state transitions — each maps naturally to a future API endpoint.

## Known limitations

- Single-browser, single-user persistence; no sync, backups or multi-user concurrency.
- Logins and permissions run in the browser — a demonstration, **not** secure authentication or authorisation. All accounts share one demo password.
- Everyone using the same browser shares the same demo data (useful for showing approvals moving between people).
- No real authentication, audit log integrity, tax, double-entry accounting, payments or bank integration.
- Currency is display-configurable in `src/config/app.ts`; amounts are not converted.
- Invoices cannot be created in the UI yet (status changes only).
- Integrations, backups and security policies are simulated; partner entries other than OpenText and Mitsumi Distribution are examples to replace.
- Payroll and tax figures are illustrative, not a payroll engine.
- Charts and fonts load from the bundle; the Inter font uses Google Fonts when online and falls back to system fonts offline.

## Production roadmap (not implemented)

Backend API · database & migrations · authentication and server-enforced permissions · audit logging ·
transaction integrity · backup & recovery · data protection & deployment hardening · integration and E2E tests ·
organisation-specific business rules (approval matrix, chart of accounts, tax).
