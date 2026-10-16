-- RedefineTables
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
    "order" REAL NOT NULL,
    "columnId" TEXT NOT NULL,
    "linphoneId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("columnId", "createdAt", "houseName", "id", "linphoneId", "nextCall", "note", "olxUrl", "order", "ownerName", "phone", "phoneKey", "rentmeUrl", "updatedAt") SELECT "columnId", "createdAt", "houseName", "id", "linphoneId", "nextCall", "note", "olxUrl", "order", "ownerName", "phone", "phoneKey", "rentmeUrl", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_columnId_order_idx" ON "Lead"("columnId", "order");
CREATE INDEX "Lead_phoneKey_idx" ON "Lead"("phoneKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
