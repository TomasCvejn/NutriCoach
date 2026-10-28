-- AlterTable
ALTER TABLE "Client" ADD COLUMN "planSpecifics" TEXT;

-- CreateTable
CREATE TABLE "PlanMeal" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanMeal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanRecommendation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanMeal_clientId_dayType_position_idx" ON "PlanMeal"("clientId", "dayType", "position");

-- CreateIndex
CREATE INDEX "PlanRecommendation_clientId_position_idx" ON "PlanRecommendation"("clientId", "position");
