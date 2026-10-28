-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "categories" JSONB NOT NULL DEFAULT [],
    "prepMinutes" INTEGER,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "dietFlags" JSONB NOT NULL DEFAULT [],
    "allergens" JSONB NOT NULL DEFAULT [],
    "ingredients" JSONB NOT NULL DEFAULT [],
    "steps" JSONB NOT NULL DEFAULT [],
    "substitutions" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Recipe_coachId_status_idx" ON "Recipe"("coachId", "status");
