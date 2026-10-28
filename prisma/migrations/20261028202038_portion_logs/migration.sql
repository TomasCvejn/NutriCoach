-- CreateTable
CREATE TABLE "PortionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "palms" REAL NOT NULL DEFAULT 0,
    "hands" REAL NOT NULL DEFAULT 0,
    "fists" REAL NOT NULL DEFAULT 0,
    "thumbs" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortionLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PortionLog_clientId_date_slot_key" ON "PortionLog"("clientId", "date", "slot");
