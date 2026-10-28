-- CreateTable
CREATE TABLE "FoodEntry" (
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
    "sugar" REAL,
    "saturatedFat" REAL,
    "sodium" REAL,
    "potassium" REAL,
    "calcium" REAL,
    "iron" REAL,
    "magnesium" REAL,
    "vitaminC" REAL,
    "vitaminD" REAL,
    "vitaminB12" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FoodEntry_clientId_date_idx" ON "FoodEntry"("clientId", "date");
