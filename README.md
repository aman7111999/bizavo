# Bizavo Construction OS

Bizavo is a multi-tenant business operating system. This repository contains the construction industry pack: project delivery, contracts, procurement, Zoho-inspired inventory control, subcontractors, workforce, payroll, finance and an editable public company page.

The product is intentionally built around connected transactions. A purchase order can be approved, received into a site store, issued to a project and reflected in both inventory valuation and project profitability without re-entering the same cost.

## Stack

- Next.js 15 App Router and TypeScript
- PostgreSQL on Supabase
- Prisma ORM and PostgreSQL row-level security
- Auth.js credentials authentication
- Tailwind CSS and shadcn/ui-style components
- Supabase Storage for project documents
- Vercel deployment from GitHub `main`

## What works

### Multi-tenancy and access

- Isolated organizations with an `Industry` enum
- Owner, Admin, Project Manager, Site Engineer, Procurement, HR, Accountant and Viewer roles
- Server-side permission checks on pages and mutations
- Site Engineers see only assigned projects
- Owner signup, organization creation, expiring/revocable role invite links, role changes and project assignment
- Every tenant-owned table carries `organizationId`; Supabase-facing tables have RLS enabled

### Projects and contracts

- Project portfolio, status filters, dates, client, budget and site details
- Multiple contracts and milestone billing schedules
- Milestone completion and progress tracking
- Completing a milestone creates a draft client invoice
- Delivery phase breakdown with assignee, status and completion
- Project document upload and secure signed downloads
- Project-level budget, actual cost, revenue, profit and margin

### Vendors, procurement and inventory

- Material and service vendor directory, contacts, GSTIN, payment terms, rating and notes
- Itemized project purchase orders
- Request → approve/reject → partial/full receipt workflow
- GRNs that update stock and automatically create vendor payables
- Item catalogue with SKU, unit, category, preferred vendor and reorder level
- Central warehouses and project-linked site stores
- Weighted-average costing and stock valuation
- Project material issues, site consumption, transfers and adjustments
- Immutable stock movement history and low-stock signals

### Subcontractors

- Trade partner directory
- Project and milestone-linked work orders
- Work-order value and retention
- Subcontractor bill creation with value validation
- Invoiced, paid and pending amounts per work order

### HR and workforce

- Employee directory, contact, department, designation and project assignment
- Salary structure with basic, allowances and deductions
- Employee daily attendance by project
- Site labour headcount by category, present/absent and daily rate
- Leave application, approval/rejection and balance updates
- Monthly payroll runs with project cost allocation
- Finance-controlled payroll payment posting with bank method/reference
- Downloadable PDF payslips

### Finance

- System chart of accounts
- Double-entry journals generated from operational transactions
- Milestone/client invoices and client payments
- Vendor and subcontractor payables and payments
- Client, vendor, subcontractor and payroll payment register
- Direct project and organization expenses
- Project-wise P&L
- Organization P&L and balance sheet with a live balance check
- Live dashboard metrics; no hardcoded operational totals

### Public page and leads

- One editable public page per organization
- Hero, about, services, project showcase, contact details and brand accent
- Publish/unpublish control
- Enquiry form that creates organization-scoped CRM leads
- Lead status workflow: New, Contacted, Qualified, Won and Lost

## Phase 1 simplifications

- Auth uses email/password. Invite links are copied manually; transactional email delivery is deferred.
- One login currently belongs to one organization. Cross-workspace switching for consultants and group-company users is deferred.
- Bizavo customer subscription billing is separate from each construction company’s accounting and is deferred until pricing and a payment gateway are selected.
- Payroll covers earnings, deductions and payslips, but not PF, ESI, professional tax or statutory filing.
- Finance is accrual-based double entry, but GST/TDS returns, bank feeds, reconciliation, credit notes and period closing are deferred.
- Inventory supports weighted-average valuation. Serial/batch tracking, composite items, barcode scanning, cycle counts and demand forecasting are deferred.
- Documents are secure project attachments, not a versioned document management system.
- The public page uses structured fields and selected projects; it is not a general visual page builder.

## Future-ready modules

Future construction modules are registered in `lib/modules.ts` with stable organization/project data boundaries:

- Equipment and asset tracking
- Safety and compliance incidents
- BOQ estimation and revisions
- Subcontractor tendering and bids
- Client progress portal

The same `Organization.industry` boundary supports future hospital, gym, retail, professional services and manufacturing packs without changing tenant identity or the shared finance/people core.

## Operating the product

See [OPERATIONS.md](./OPERATIONS.md) for the owner/admin responsibility matrix, onboarding checklist, purchase-to-pay, milestone-to-cash and payroll payment workflows, daily/monthly controls, deployment procedure and the recommended SaaS billing rollout.

## Local setup

### Prerequisites

- Node.js 20 or newer
- A Supabase PostgreSQL project
- A private Supabase Storage bucket named `project-documents`

### Install

```bash
npm install
cp .env.example .env.local
```

Set the environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase pooled PostgreSQL connection used by the application |
| `DIRECT_URL` | Supabase direct PostgreSQL connection used by Prisma migrations |
| `AUTH_SECRET` | Random secret of at least 32 bytes |
| `AUTH_TRUST_HOST` | Set to `true` on Vercel |
| `NEXT_PUBLIC_APP_URL` | Local or production application origin |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for signed project-document operations |
| `SUPABASE_STORAGE_BUCKET` | Defaults to `project-documents` |

Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable.

### Database

```bash
npm run db:migrate
npm run db:seed
```

The seed is idempotent for the demo organization and creates three projects, multiple vendors, POs, inventory movements, subcontractors, employees, payroll, invoices, journals and website leads.

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

Demo login:

```text
owner@demo.bizavo.in
Bizavo@2026
```

Public demo page:

```text
/s/apex-buildcon
```

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Add all environment variables from `.env.example`.
3. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Deploy from `main`.

`vercel.json` runs `prisma migrate deploy` before the production Next.js build, so committed migrations are applied on deployment. Production pushes to `main` trigger new deployments after the Vercel Git integration is connected.

## Security notes

- Authenticated application requests never accept an organization identifier from forms; it comes from the signed session.
- Mutations re-fetch business records with both `id` and `organizationId`.
- Project-restricted roles receive a project-membership filter.
- Project documents are private and opened through short-lived signed URLs after both organization and project-access checks.
- Payslips are available only to HR managers or the employee account linked to that payslip.
- Payment posting re-reads the current balance in a serializable transaction to prevent concurrent overpayment.
- Database RLS protects tenant-owned tables from direct Supabase API access. Prisma uses the trusted server connection and repeats tenant authorization in the application layer.
