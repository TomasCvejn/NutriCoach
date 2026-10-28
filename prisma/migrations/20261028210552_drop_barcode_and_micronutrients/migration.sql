-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Food" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "ownerId" TEXT,
    "offCode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "fiber" REAL,
    "sodium" REAL,
    "servings" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Food_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Food" ("brand", "carbs", "createdAt", "fat", "fiber", "id", "kcal", "name", "offCode", "ownerId", "protein", "servings", "sodium", "source", "updatedAt") SELECT "brand", "carbs", "createdAt", "fat", "fiber", "id", "kcal", "name", "offCode", "ownerId", "protein", "servings", "sodium", "source", "updatedAt" FROM "Food";
DROP TABLE "Food";
ALTER TABLE "new_Food" RENAME TO "Food";
CREATE UNIQUE INDEX "Food_offCode_key" ON "Food"("offCode");
CREATE INDEX "Food_ownerId_idx" ON "Food"("ownerId");
CREATE TABLE "new_FoodEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "foodId" TEXT,
    "name" TEXT,
    "brand" TEXT,
    "grams" REAL,
    "servingLabel" TEXT,
    "servingCount" REAL,
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "fiber" REAL,
    "sodium" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FoodEntry" ("brand", "carbs", "clientId", "createdAt", "date", "fat", "fiber", "foodId", "grams", "id", "kcal", "name", "protein", "servingCount", "servingLabel", "slot", "sodium", "updatedAt") SELECT "brand", "carbs", "clientId", "createdAt", "date", "fat", "fiber", "foodId", "grams", "id", "kcal", "name", "protein", "servingCount", "servingLabel", "slot", "sodium", "updatedAt" FROM "FoodEntry";
DROP TABLE "FoodEntry";
ALTER TABLE "new_FoodEntry" RENAME TO "FoodEntry";
CREATE INDEX "FoodEntry_clientId_date_idx" ON "FoodEntry"("clientId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
