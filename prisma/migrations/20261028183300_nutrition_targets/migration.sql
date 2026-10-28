-- CreateTable
CREATE TABLE "NutritionTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "dayType" TEXT NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "kcal" INTEGER,
    "protein" INTEGER,
    "carbs" INTEGER,
    "fat" INTEGER,
    "fiber" INTEGER,
    "sodium" INTEGER,
    "palms" REAL,
    "hands" REAL,
    "fists" REAL,
    "thumbs" REAL,
    "fluidMl" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NutritionTarget_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionTarget_clientId_dayType_effectiveFrom_key" ON "NutritionTarget"("clientId", "dayType", "effectiveFrom");
