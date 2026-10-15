-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "otherDeductionsNote" TEXT;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "generatedAt" TIMESTAMPTZ,
ADD COLUMN     "sourceHash" TEXT;
