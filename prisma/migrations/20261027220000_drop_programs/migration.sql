-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "trackingMode" TEXT NOT NULL DEFAULT 'CALORIES',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Client_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("coachId", "createdAt", "id", "trackingMode", "userId") SELECT "coachId", "createdAt", "id", "trackingMode", "userId" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
CREATE INDEX "Client_coachId_idx" ON "Client"("coachId");
CREATE TABLE "new_Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "trackingMode" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Invite" ("clientId", "coachId", "createdAt", "email", "expiresAt", "id", "name", "revokedAt", "token", "trackingMode", "usedAt") SELECT "clientId", "coachId", "createdAt", "email", "expiresAt", "id", "name", "revokedAt", "token", "trackingMode", "usedAt" FROM "Invite";
DROP TABLE "Invite";
ALTER TABLE "new_Invite" RENAME TO "Invite";
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE UNIQUE INDEX "Invite_clientId_key" ON "Invite"("clientId");
CREATE INDEX "Invite_coachId_idx" ON "Invite"("coachId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
