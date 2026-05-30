-- CreateTable
CREATE TABLE "AutoTagRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchantKey" TEXT NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutoTagRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoCategoryRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchantKey" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutoCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "debitOrCredit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "merchantIdentifier" TEXT,
    "accountIdentifier" TEXT,
    "categoryId" INTEGER,
    "notes" TEXT,
    "importId" INTEGER NOT NULL,
    "rawCsvJson" TEXT NOT NULL,
    "merchantId" INTEGER,
    "baseFingerprint" TEXT NOT NULL,
    "occurrenceIndex" INTEGER NOT NULL DEFAULT 0,
    "merchantKey" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountIdentifier", "amount", "baseFingerprint", "categoryId", "createdAt", "debitOrCredit", "description", "id", "importId", "merchantId", "merchantIdentifier", "notes", "occurrenceIndex", "rawCsvJson", "referenceNumber", "transactionDate", "updatedAt") SELECT "accountIdentifier", "amount", "baseFingerprint", "categoryId", "createdAt", "debitOrCredit", "description", "id", "importId", "merchantId", "merchantIdentifier", "notes", "occurrenceIndex", "rawCsvJson", "referenceNumber", "transactionDate", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_baseFingerprint_idx" ON "Transaction"("baseFingerprint");
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");
CREATE INDEX "Transaction_merchantKey_idx" ON "Transaction"("merchantKey");
CREATE UNIQUE INDEX "Transaction_baseFingerprint_occurrenceIndex_key" ON "Transaction"("baseFingerprint", "occurrenceIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AutoTagRule_merchantKey_idx" ON "AutoTagRule"("merchantKey");

-- CreateIndex
CREATE UNIQUE INDEX "AutoTagRule_merchantKey_tagId_key" ON "AutoTagRule"("merchantKey", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoCategoryRule_merchantKey_key" ON "AutoCategoryRule"("merchantKey");
