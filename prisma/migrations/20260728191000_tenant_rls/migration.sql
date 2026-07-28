-- Bizavo tenant isolation: application queries are scoped server-side and these
-- policies protect every tenant-owned table when accessed through Supabase APIs.
-- The server's migration/database owner retains PostgreSQL's owner bypass.

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'Membership',
    'OrganizationInvite',
    'Project',
    'ProjectContract',
    'ContractMilestone',
    'ProjectPhase',
    'ProjectDocument',
    'Vendor',
    'ItemCategory',
    'InventoryItem',
    'InventoryLocation',
    'InventoryStock',
    'PurchaseOrder',
    'GoodsReceipt',
    'MaterialIssue',
    'StockMovement',
    'Subcontractor',
    'WorkOrder',
    'Employee',
    'EmployeeAttendance',
    'LaborAttendance',
    'LeaveRequest',
    'PayrollRun',
    'Payslip',
    'ChartAccount',
    'JournalEntry',
    'ClientInvoice',
    'ClientPayment',
    'VendorBill',
    'VendorPayment',
    'Expense',
    'LandingPage',
    'Lead'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_organization_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true))',
      tenant_table
    );
  END LOOP;
END $$;

-- Global authentication and child transaction tables are server-only through
-- the Supabase Data API. The application reaches them through Prisma.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoodsReceiptItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialIssueItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeProjectAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY;
