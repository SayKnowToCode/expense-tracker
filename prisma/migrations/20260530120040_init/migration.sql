-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MerchantRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "merchantId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MerchantRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MerchantRule_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Import" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "importDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalCsv" TEXT NOT NULL,
    "summary" TEXT
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_TransactionTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_TransactionTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TransactionTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_identifier_key" ON "Merchant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Transaction_baseFingerprint_idx" ON "Transaction"("baseFingerprint");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_baseFingerprint_occurrenceIndex_key" ON "Transaction"("baseFingerprint", "occurrenceIndex");

-- CreateIndex
CREATE UNIQUE INDEX "_TransactionTags_AB_unique" ON "_TransactionTags"("A", "B");

-- CreateIndex
CREATE INDEX "_TransactionTags_B_index" ON "_TransactionTags"("B");
