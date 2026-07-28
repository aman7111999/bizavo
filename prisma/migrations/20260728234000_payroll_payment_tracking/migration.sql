ALTER TABLE "PayrollRun"
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "paymentReference" TEXT;
