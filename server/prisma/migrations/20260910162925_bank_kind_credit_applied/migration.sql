-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'Bank';

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "appliedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
