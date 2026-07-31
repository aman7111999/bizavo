CREATE TYPE "BusinessDocumentType" AS ENUM ('PAYMENT_RECEIPT', 'SALES_RECEIPT', 'QUOTATION', 'PROFORMA_INVOICE');
CREATE TYPE "BusinessDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "CommunicationStatus" AS ENUM ('READY', 'SENT', 'FAILED');

CREATE TABLE "BusinessDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "clientPaymentId" TEXT,
  "type" "BusinessDocumentType" NOT NULL,
  "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'ISSUED',
  "documentNumber" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "recipientPhone" TEXT,
  "billingAddress" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotal" DECIMAL(16,2) NOT NULL,
  "taxAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(16,2) NOT NULL,
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocumentItem" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'unit',
  "unitPrice" DECIMAL(16,2) NOT NULL,
  "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(16,2) NOT NULL,
  CONSTRAINT "BusinessDocumentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentShare" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "recipient" TEXT NOT NULL,
  "status" "CommunicationStatus" NOT NULL DEFAULT 'READY',
  "providerId" TEXT,
  "errorMessage" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessDocument_clientPaymentId_key" ON "BusinessDocument"("clientPaymentId");
CREATE UNIQUE INDEX "BusinessDocument_organizationId_documentNumber_key" ON "BusinessDocument"("organizationId", "documentNumber");
CREATE INDEX "BusinessDocument_organizationId_type_issueDate_idx" ON "BusinessDocument"("organizationId", "type", "issueDate");
CREATE UNIQUE INDEX "DocumentShare_tokenHash_key" ON "DocumentShare"("tokenHash");
CREATE INDEX "DocumentShare_organizationId_createdAt_idx" ON "DocumentShare"("organizationId", "createdAt");
CREATE INDEX "DocumentShare_documentId_createdAt_idx" ON "DocumentShare"("documentId", "createdAt");

ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_clientPaymentId_fkey" FOREIGN KEY ("clientPaymentId") REFERENCES "ClientPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentItem" ADD CONSTRAINT "BusinessDocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BusinessDocument"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "DocumentShare" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DocumentShare"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- Child line items are never exposed through the Supabase Data API. Prisma
-- reaches them through the trusted server connection after tenant checks.
ALTER TABLE "BusinessDocumentItem" ENABLE ROW LEVEL SECURITY;
