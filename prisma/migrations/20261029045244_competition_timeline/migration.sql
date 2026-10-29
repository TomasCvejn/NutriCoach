-- CreateTable
CREATE TABLE "TimelineTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sport" TEXT,
    "location" TEXT,
    "priority" TEXT NOT NULL,
    "notes" TEXT,
    "result" TEXT,
    "felt" INTEGER,
    "timeline" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Competition_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Competition" ("clientId", "createdAt", "date", "felt", "id", "location", "name", "notes", "priority", "result", "sport", "updatedAt") SELECT "clientId", "createdAt", "date", "felt", "id", "location", "name", "notes", "priority", "result", "sport", "updatedAt" FROM "Competition";
DROP TABLE "Competition";
ALTER TABLE "new_Competition" RENAME TO "Competition";
CREATE INDEX "Competition_clientId_date_idx" ON "Competition"("clientId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
