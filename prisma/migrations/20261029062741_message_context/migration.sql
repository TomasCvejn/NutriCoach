-- AlterTable
ALTER TABLE "Message" ADD COLUMN "contextKey" TEXT;
ALTER TABLE "Message" ADD COLUMN "contextType" TEXT;

-- CreateIndex
CREATE INDEX "Message_clientId_contextType_contextKey_idx" ON "Message"("clientId", "contextType", "contextKey");
