/*
  Warnings:

  - You are about to drop the `meetings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_organizationId_fkey";

-- AlterTable
ALTER TABLE "objectives" ADD COLUMN     "checkinCadence" TEXT NOT NULL DEFAULT 'Monthly',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'Team',
ADD COLUMN     "ownerId" UUID,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'Medium';

-- DropTable
DROP TABLE "meetings";

-- CreateTable
CREATE TABLE "review_meetings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "heldById" UUID,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "agenda" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_meetings_organizationId_scheduledAt_idx" ON "review_meetings"("organizationId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "review_meetings" ADD CONSTRAINT "review_meetings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_meetings" ADD CONSTRAINT "review_meetings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
