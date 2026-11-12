-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'UNCONFIRMED';

-- Sign-in codes live 10 minutes and are now keyed by email, so old rows can go.
DELETE FROM "LoginCode";

-- DropForeignKey
ALTER TABLE "LoginCode" DROP CONSTRAINT "LoginCode_memberId_fkey";

-- DropIndex
DROP INDEX "LoginCode_memberId_createdAt_idx";

-- AlterTable
ALTER TABLE "LoginCode" DROP COLUMN "memberId",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "pendingName" TEXT;

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "failedLogins",
DROP COLUMN "lockedUntil",
DROP COLUMN "mustChangePassword",
DROP COLUMN "passwordHash",
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TutoringRequest" ADD COLUMN     "confirmToken" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- Requests made before confirmation existed count as confirmed when they were made.
UPDATE "TutoringRequest" SET "confirmedAt" = "createdAt";

-- CreateTable
CREATE TABLE "AdminLoginAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailBudget" (
    "day" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "alertedAt" TIMESTAMP(3),

    CONSTRAINT "EmailBudget_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "AdminLoginAttempt_ipHash_createdAt_idx" ON "AdminLoginAttempt"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLoginAttempt_createdAt_idx" ON "AdminLoginAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "LoginCode_email_createdAt_idx" ON "LoginCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TutoringRequest_confirmToken_key" ON "TutoringRequest"("confirmToken");

