-- CreateTable
CREATE TABLE "BodyComp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "weightKg" REAL,
    "bodyFatPct" REAL,
    "leanMassKg" REAL,
    "waistCm" REAL,
    "hipsCm" REAL,
    "chestCm" REAL,
    "thighCm" REAL,
    "armCm" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BodyComp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BodyComp_clientId_date_idx" ON "BodyComp"("clientId", "date");
