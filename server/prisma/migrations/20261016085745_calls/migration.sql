-- CreateTable
CREATE TABLE "Call" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "connectedAt" DATETIME,
    "duration" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "Call_phoneKey_idx" ON "Call"("phoneKey");

-- CreateIndex
CREATE INDEX "Call_startedAt_idx" ON "Call"("startedAt");
