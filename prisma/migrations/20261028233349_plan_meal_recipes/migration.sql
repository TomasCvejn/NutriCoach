-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "dayType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "timeHint" TEXT,
    "guidance" TEXT,
    "palms" REAL,
    "hands" REAL,
    "fists" REAL,
    "thumbs" REAL,
    "note" TEXT,
    "recipeIds" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanMeal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanMeal" ("clientId", "createdAt", "dayType", "fists", "guidance", "hands", "id", "name", "note", "palms", "position", "thumbs", "timeHint", "updatedAt") SELECT "clientId", "createdAt", "dayType", "fists", "guidance", "hands", "id", "name", "note", "palms", "position", "thumbs", "timeHint", "updatedAt" FROM "PlanMeal";
DROP TABLE "PlanMeal";
ALTER TABLE "new_PlanMeal" RENAME TO "PlanMeal";
CREATE INDEX "PlanMeal_clientId_dayType_position_idx" ON "PlanMeal"("clientId", "dayType", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
