CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'BILLING', 'SUPPORT');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL', 'MANUAL');
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "SubscriptionRequestType" AS ENUM ('CHANGE_PLAN', 'CANCEL', 'REACTIVATE');
CREATE TYPE "SubscriptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

ALTER TABLE "Organization"
  ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT;

CREATE TABLE "PlatformAdministrator" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "PlatformRole" NOT NULL DEFAULT 'SUPPORT',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAdministrator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "monthlyPrice" DECIMAL(14,2) NOT NULL,
  "annualPrice" DECIMAL(14,2) NOT NULL,
  "trialDays" INTEGER NOT NULL DEFAULT 14,
  "maxUsers" INTEGER NOT NULL,
  "maxProjects" INTEGER NOT NULL,
  "maxStorageMb" INTEGER NOT NULL,
  "modules" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSubscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationBillingProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "billingEmail" TEXT NOT NULL,
  "billingPhone" TEXT,
  "taxId" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'India',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationBillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationModuleOverride" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationModuleOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionInvoice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "type" "SubscriptionRequestType" NOT NULL,
  "requestedPlanId" TEXT,
  "status" "SubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "resolutionNote" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdministrator_userId_key" ON "PlatformAdministrator"("userId");
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE UNIQUE INDEX "OrganizationSubscription_organizationId_key" ON "OrganizationSubscription"("organizationId");
CREATE INDEX "OrganizationSubscription_status_currentPeriodEnd_idx" ON "OrganizationSubscription"("status", "currentPeriodEnd");
CREATE UNIQUE INDEX "OrganizationBillingProfile_organizationId_key" ON "OrganizationBillingProfile"("organizationId");
CREATE UNIQUE INDEX "OrganizationModuleOverride_organizationId_moduleKey_key" ON "OrganizationModuleOverride"("organizationId", "moduleKey");
CREATE INDEX "OrganizationModuleOverride_organizationId_idx" ON "OrganizationModuleOverride"("organizationId");
CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE INDEX "SubscriptionInvoice_organizationId_status_idx" ON "SubscriptionInvoice"("organizationId", "status");
CREATE INDEX "SubscriptionInvoice_dueDate_status_idx" ON "SubscriptionInvoice"("dueDate", "status");
CREATE INDEX "SubscriptionPayment_organizationId_paymentDate_idx" ON "SubscriptionPayment"("organizationId", "paymentDate");
CREATE INDEX "SubscriptionRequest_organizationId_status_idx" ON "SubscriptionRequest"("organizationId", "status");
CREATE INDEX "SubscriptionRequest_status_createdAt_idx" ON "SubscriptionRequest"("status", "createdAt");
CREATE INDEX "PlatformAuditLog_organizationId_createdAt_idx" ON "PlatformAuditLog"("organizationId", "createdAt");
CREATE INDEX "PlatformAuditLog_actorUserId_createdAt_idx" ON "PlatformAuditLog"("actorUserId", "createdAt");

ALTER TABLE "PlatformAdministrator" ADD CONSTRAINT "PlatformAdministrator_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationBillingProfile" ADD CONSTRAINT "OrganizationBillingProfile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationModuleOverride" ADD CONSTRAINT "OrganizationModuleOverride_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_requestedPlanId_fkey"
  FOREIGN KEY ("requestedPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SubscriptionPlan" (
  "id", "code", "name", "description", "currency", "monthlyPrice", "annualPrice",
  "trialDays", "maxUsers", "maxProjects", "maxStorageMb", "modules", "active", "isDefault", "updatedAt"
) VALUES
  (
    'bizavo_plan_starter', 'STARTER', 'Starter', 'Core project and purchasing controls for a growing contractor.',
    'INR', 4999, 49990, 14, 10, 5, 5120,
    '["projects","procurement","inventory","landing"]'::jsonb, true, true, CURRENT_TIMESTAMP
  ),
  (
    'bizavo_plan_growth', 'GROWTH', 'Growth', 'Full construction operations for multi-project teams.',
    'INR', 12999, 129990, 14, 40, 25, 25600,
    '["projects","procurement","inventory","subcontractors","hr","finance","landing"]'::jsonb, true, false, CURRENT_TIMESTAMP
  ),
  (
    'bizavo_plan_enterprise', 'ENTERPRISE', 'Enterprise', 'Unlimited construction operations with controlled custom terms.',
    'INR', 29999, 299990, 30, 250, 250, 102400,
    '["projects","procurement","inventory","subcontractors","hr","finance","landing"]'::jsonb, true, false, CURRENT_TIMESTAMP
  );

INSERT INTO "OrganizationSubscription" (
  "id", "organizationId", "planId", "status", "billingCycle", "startedAt",
  "currentPeriodStart", "currentPeriodEnd", "trialEndsAt", "createdAt", "updatedAt"
)
SELECT
  'subscription_' || "id",
  "id",
  'bizavo_plan_growth',
  'ACTIVE',
  'ANNUAL',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '1 year',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization";

INSERT INTO "OrganizationBillingProfile" (
  "id", "organizationId", "legalName", "billingEmail", "country", "createdAt", "updatedAt"
)
SELECT
  'billing_' || o."id",
  o."id",
  o."name",
  COALESCE(
    (SELECT u."email" FROM "Membership" m JOIN "User" u ON u."id" = m."userId"
      WHERE m."organizationId" = o."id" AND m."role" = 'OWNER' LIMIT 1),
    'billing@bizavo.invalid'
  ),
  'India',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o;

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'OrganizationSubscription',
    'OrganizationBillingProfile',
    'OrganizationModuleOverride',
    'SubscriptionInvoice',
    'SubscriptionPayment',
    'SubscriptionRequest',
    'PlatformAuditLog'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
  END LOOP;
END $$;

ALTER TABLE "PlatformAdministrator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
