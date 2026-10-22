-- Ikki operator rejimi: Operator jadvali, karta/qo'ng'iroqda operator, softphone id'lari matn.
-- Mavjud ma'lumotlar birinchi operator ("Otajon", Linphone) nomiga o'tkaziladi.

-- CreateTable
CREATE TABLE "Operator" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "color" INTEGER NOT NULL DEFAULT 0,
    "softphone" TEXT NOT NULL DEFAULT '',
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Operator" ("name", "color", "softphone") VALUES ('Otajon', 1, 'linphone');

-- Lead: operator + extId, linphoneId olib tashlanadi
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "phoneKey" TEXT NOT NULL DEFAULT '',
    "houseName" TEXT NOT NULL DEFAULT '',
    "olxUrl" TEXT NOT NULL DEFAULT '',
    "rentmeUrl" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "nextCall" TEXT NOT NULL DEFAULT '',
    "callResult" TEXT NOT NULL DEFAULT '',
    "operator" TEXT NOT NULL DEFAULT '',
    "extId" TEXT NOT NULL DEFAULT '',
    "order" REAL NOT NULL,
    "columnId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("id", "ownerName", "phone", "phoneKey", "houseName", "olxUrl", "rentmeUrl", "note", "nextCall", "callResult", "operator", "extId", "order", "columnId", "createdAt", "updatedAt")
SELECT "id", "ownerName", "phone", "phoneKey", "houseName", "olxUrl", "rentmeUrl", "note", "nextCall", "callResult", 'Otajon', COALESCE(CAST("linphoneId" AS TEXT), ''), "order", "columnId", "createdAt", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_columnId_order_idx" ON "Lead"("columnId", "order");
CREATE INDEX "Lead_phoneKey_idx" ON "Lead"("phoneKey");

-- ContactImport (LinphoneImport o'rniga)
CREATE TABLE "ContactImport" (
    "operator" TEXT NOT NULL,
    "extId" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("operator", "extId")
);
INSERT INTO "ContactImport" ("operator", "extId", "importedAt") SELECT 'Otajon', CAST("linphoneId" AS TEXT), "importedAt" FROM "LinphoneImport";
DROP TABLE "LinphoneImport";

-- Call: matnli id, operator + extId
CREATE TABLE "new_Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operator" TEXT NOT NULL DEFAULT '',
    "extId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "connectedAt" DATETIME,
    "duration" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Call" ("id", "operator", "extId", "direction", "status", "number", "phoneKey", "startedAt", "connectedAt", "duration")
SELECT 'lp' || "id", 'Otajon', CAST("id" AS TEXT), "direction", "status", "number", "phoneKey", "startedAt", "connectedAt", "duration" FROM "Call";
DROP TABLE "Call";
ALTER TABLE "new_Call" RENAME TO "Call";
CREATE UNIQUE INDEX "Call_operator_extId_key" ON "Call"("operator", "extId");
CREATE INDEX "Call_phoneKey_idx" ON "Call"("phoneKey");
CREATE INDEX "Call_startedAt_idx" ON "Call"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
