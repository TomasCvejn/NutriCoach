-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "type" TEXT NOT NULL,
    "sport" TEXT,
    "durationMin" INTEGER NOT NULL,
    "intensity" TEXT NOT NULL,
    "description" TEXT,
    "rpe" INTEGER,
    "felt" INTEGER,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrainingSession_clientId_date_idx" ON "TrainingSession"("clientId", "date");
