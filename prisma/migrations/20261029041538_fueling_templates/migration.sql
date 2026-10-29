-- CreateTable
CREATE TABLE "FuelingTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionTypes" JSONB NOT NULL DEFAULT [],
    "minDurationMin" INTEGER,
    "maxDurationMin" INTEGER,
    "minIntensity" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "pre" JSONB NOT NULL DEFAULT [],
    "duringCarbsPerHour" INTEGER,
    "duringFluidPerHour" INTEGER,
    "duringSodiumPerHour" INTEGER,
    "duringText" TEXT,
    "postWithinMin" INTEGER,
    "postProtein" INTEGER,
    "postCarbs" INTEGER,
    "postFluidText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FuelingTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainingSession" (
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
    "fuelingTemplateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSession_fuelingTemplateId_fkey" FOREIGN KEY ("fuelingTemplateId") REFERENCES "FuelingTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TrainingSession" ("clientId", "createdAt", "date", "description", "durationMin", "felt", "id", "intensity", "note", "rpe", "sport", "startTime", "type", "updatedAt") SELECT "clientId", "createdAt", "date", "description", "durationMin", "felt", "id", "intensity", "note", "rpe", "sport", "startTime", "type", "updatedAt" FROM "TrainingSession";
DROP TABLE "TrainingSession";
ALTER TABLE "new_TrainingSession" RENAME TO "TrainingSession";
CREATE INDEX "TrainingSession_clientId_date_idx" ON "TrainingSession"("clientId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
