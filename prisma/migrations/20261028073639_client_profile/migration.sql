-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "trackingMode" TEXT NOT NULL DEFAULT 'CALORIES',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sex" TEXT,
    "birthDate" TEXT,
    "heightCm" INTEGER,
    "weightKg" REAL,
    "phone" TEXT,
    "primaryGoal" TEXT,
    "targetWeightKg" REAL,
    "targetDate" TEXT,
    "successText" TEXT,
    "likedFoods" TEXT,
    "dislikedFoods" TEXT,
    "mealsPerDay" INTEGER,
    "dietType" TEXT,
    "allergens" JSONB NOT NULL DEFAULT [],
    "allergiesNote" TEXT,
    "restrictions" TEXT,
    "sports" TEXT,
    "sportLevel" TEXT,
    "sessionsPerWeek" INTEGER,
    "sessionMinutes" INTEGER,
    "healthConditions" TEXT,
    "medications" TEXT,
    "otherInfo" TEXT,
    CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Client_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("coachId", "createdAt", "id", "trackingMode", "userId") SELECT "coachId", "createdAt", "id", "trackingMode", "userId" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
CREATE INDEX "Client_coachId_idx" ON "Client"("coachId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
