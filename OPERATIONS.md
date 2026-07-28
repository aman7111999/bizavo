# Bizavo operating handbook

This handbook separates two responsibilities:

1. **Construction operations inside a customer organization** — projects, procurement, inventory, people and accounting.
2. **The Bizavo software business** — onboarding customer organizations, support, releases and, later, subscription collection.

Do not mix Bizavo subscription receipts with a customer organization’s client invoices or vendor payments.

## Who manages what

| Role | Primary responsibility | Financial visibility | Approval authority |
| --- | --- | --- | --- |
| Owner | Company controls, admins, policy and final oversight | Organization-wide | All workflows |
| Admin | Workspace setup, users and operational exception handling | Organization-wide | PO and operational approvals |
| Project Manager | Project delivery, phases, work orders and PO requests | Project and organization finance view | Requests POs; manages subcontract work |
| Site Engineer | Daily execution and material movements | No Finance module | Assigned projects and their site stores only |
| Procurement | Vendors, item catalogue, POs, receipts and inventory | Finance read access for payable context | Approves POs and receives material |
| HR | Employees, attendance, leave and payroll processing | Payroll only | Leave and payroll processing |
| Accountant | Invoices, collections, payables, expenses and statements | Organization-wide | Records payments and closes books |
| Viewer | Read-only operational oversight | No Finance or HR | None |

Owner and Admin manage roles from **Settings → Team & roles**. Site Engineer access is not active until at least one project is assigned. If an employee uses self-service leave or payslips, create the employee with the same email before accepting the team invitation; Bizavo links the records during invite acceptance.

## Initial customer onboarding

Use one organization per legal operating company.

1. Create the Owner account and organization.
2. Confirm company name, currency and public-page contact details.
3. Invite Admin, HR, Accountant and Procurement leads first.
4. Add Project Managers and Site Engineers; assign every Site Engineer to the correct projects.
5. Create the initial project portfolio and contracts.
6. Configure contract milestones so their billing percentages total no more than 100%.
7. Add vendors, subcontractors and the inventory item catalogue.
8. Create warehouses/site stores and enter verified opening stock only once.
9. Add employees, salary structures and project assignments.
10. Enter opening receivables/payables as controlled finance migration entries before normal operations.
11. Run one test PO, goods receipt, material issue, milestone invoice and payment before go-live.

Keep opening data signed off by the Owner and Accountant. Never use stock adjustments or fake payments merely to make dashboard numbers look right.

## Core operating flows

### Purchase to payment

1. Project Manager or Site Engineer raises an itemized PO for an accessible project.
2. Procurement, Admin or Owner approves or rejects it.
3. Procurement/Site records the goods receipt into the correct project store.
4. Bizavo increases stock, records the GRN and creates the vendor bill/payable.
5. Site issues material to the project phase when it is consumed; only then does it become project material cost.
6. Accountant opens **Finance → Payables**, checks the vendor bill and records the actual payment date, method and bank/cheque/UPI reference.
7. The payment register and journal update together.

Do not record a vendor payment when a PO is approved. Approval is a commitment, receipt creates the liability, and the bank transaction clears it.

### Subcontractor work to payment

1. Project Manager issues a work order with scope, value, retention and optional milestone.
2. Record each valid subcontractor bill against the work order.
3. Bizavo prevents cumulative non-void billing above the work-order value.
4. Accountant pays the bill from **Finance → Payables**.
5. **Subcontractors** continues to show work-order value, invoiced, paid and pending amounts.

Retention is recorded on the work order for commercial control. Automated retention-release certificates and TDS are Phase 2.

### Milestone to client collection

1. Project Manager updates milestone progress.
2. At 100%, Bizavo creates a draft client invoice.
3. Accountant reviews tax, issue date and due date, then issues it.
4. Issuing posts receivable, revenue and output tax.
5. Accountant records each cleared receipt from **Finance → Client invoices**.
6. Bizavo updates the invoice balance, cash/bank, receivable and the payment register.

The overdue badge is calculated from the due date even if the stored status has not been changed by a scheduled job.

### Payroll to employee payment

1. HR verifies active employees, salary structure and project assignment.
2. HR processes the month from **People & HR → Payroll**.
3. Bizavo creates payslips, project/administrative labour cost and payroll payable.
4. Accountant verifies the bank file and opens **Finance → Payments**.
5. Accountant records the payroll payment with date, method and bank reference.
6. Bizavo marks the run and payslips paid, debits net payroll payable and credits cash/bank.

Payroll deductions remain in payroll payable until statutory remittance. PF, ESI, professional tax, TDS and statutory returns need the Phase 2 payroll/compliance module.

### Direct expenses

Use **Finance → Expenses** only for costs not already created through goods receipt, material consumption, subcontractor billing or payroll. This prevents double-counting.

## Daily, weekly and monthly controls

### Daily

- Site: attendance, labour headcount, receipts, material issues and progress.
- Procurement: requested POs, expected deliveries and low-stock alerts.
- Accountant: bank-confirmed receipts/payments and missing references.
- Project Manager: blocked phases, milestone progress and budget-to-actual movement.

### Weekly

- Review overdue client invoices and upcoming payables on the dashboard.
- Compare PO ordered versus received quantities.
- Investigate inventory adjustments and negative/large variances.
- Review unassigned Site Engineers and stale pending invitations.
- Review website leads and move every enquiry to a meaningful status.

### Month end

1. Finish receipts and material issues for the period.
2. Record all subcontractor bills and direct expenses.
3. Process and pay payroll.
4. Reconcile recorded payments to the bank outside Bizavo until bank reconciliation is built.
5. Review project P&L and unexplained margin changes.
6. Review balance-sheet balance check, receivables, payables, inventory and payroll deductions payable.
7. Export/archive required reports and obtain Accountant/Owner sign-off.

Formal accounting-period locks, bank reconciliation and statutory returns are Phase 2. Until then, restrict Finance Manager access and use a documented month-close sign-off.

## Data and security controls

- Give each person their own login; never share the Owner account.
- Use Admin only for people who administer the whole workspace.
- Link Site Engineers only to projects they actively work on.
- HR salary data is restricted to HR managers and the linked employee.
- Store only project documents in the document area; it is not a general secret vault.
- Rotate Auth, database and storage secrets when an administrator leaves.
- Keep Supabase point-in-time recovery/backups enabled at the database plan level.
- Test a database restore and critical workflow at least quarterly.
- Treat payment references as audit data; enter the bank transaction identifier whenever available.

## Release management

`main` is production. A push to GitHub triggers the Vercel production deployment.

1. Make changes on a branch.
2. Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.
3. Review the Vercel preview for login, dashboard, PO, inventory and Finance flows.
4. Merge/push to `main`.
5. Vercel runs `prisma migrate deploy` before building.
6. Verify the production deployment and one read-only database-backed page.
7. For migrations, verify the new workflow after deployment; never manually edit production tables.

Production secrets belong in Vercel and Supabase, never GitHub source. Keep at least one additional Owner/Admin able to respond to account emergencies.

## Support and incident routine

- **Severity 1:** login unavailable, cross-tenant exposure, incorrect duplicate payment or database outage. Stop risky operations, preserve logs, communicate status and prioritize rollback/containment.
- **Severity 2:** one module or workflow blocked with a workaround. Record affected organization, user role, record IDs, time and exact action.
- **Severity 3:** cosmetic issue or enhancement. Add it to the product backlog with screenshots and expected behavior.

Never ask customers to send passwords, database strings or storage keys. For financial corrections, create an explicit reversal/correction workflow rather than deleting journal history.

## Bizavo subscription billing roadmap

Customer billing for the Bizavo SaaS should be built as a platform-level module, not inside tenant Finance.

Recommended rollout:

1. Decide plans, per-organization base price, included users/storage and trial length.
2. Add platform models for Plan, Subscription, SubscriptionInvoice, GatewayCustomer and Entitlement.
3. Use a payment gateway hosted checkout/subscription product; store gateway IDs, never card or UPI credentials.
4. Process signed webhooks idempotently for activated, paid, failed, cancelled and refunded events.
5. Add dunning: reminders, grace period and Owner-only read-only mode before suspension.
6. Keep product entitlements separate from organization roles.
7. Create a platform operator console for organizations, plan, trial, status, usage, support notes and suspension.

Until this exists, manage early customers through a controlled external invoice register. Record organization, plan, billing period, amount, tax invoice, due date, payment date and gateway/bank reference. Do not silently disable a customer; use a written grace-period policy.

## Phase 2 priority

1. Bank feeds, reconciliation, reversals/credit notes and accounting period lock.
2. Statutory payroll, GST/TDS handling and payment/remittance schedules.
3. Platform subscriptions, entitlements and operator console.
4. Cross-organization account switching and group-company reporting.
5. Email invitations, password reset, MFA and stronger signup abuse controls.
6. Inventory reservations, cycle counts, batch/serial tracking and purchase returns.
7. BOQ, tendering, equipment, safety and client portal modules.
