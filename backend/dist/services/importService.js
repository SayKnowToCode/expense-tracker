"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAndStoreTransactions = void 0;
const prisma_1 = require("../../generated/prisma");
const merchantRuleService_1 = require("./merchantRuleService");
const prisma = new prisma_1.PrismaClient();
const parseAndStoreTransactions = async (parsedRows, importId) => {
    const created = [];
    const duplicates = [];
    for (const row of parsedRows) {
        // Detect duplicates by referenceNumber + amount + transactionDate
        const exists = await prisma.transaction.findFirst({
            where: {
                referenceNumber: row.referenceNumber,
                amount: row.amount,
                transactionDate: row.transactionDate,
            },
        });
        if (exists) {
            duplicates.push(row);
            continue;
        }
        // Merchant/category auto-matching
        const match = await (0, merchantRuleService_1.matchMerchantRule)(row.description || '');
        const transaction = await prisma.transaction.create({
            data: {
                transactionDate: new Date(row.transactionDate),
                amount: Number(row.amount),
                debitOrCredit: row.debitOrCredit || 'debit',
                description: row.description || '',
                referenceNumber: row.referenceNumber || null,
                merchantIdentifier: row.merchantIdentifier || null,
                accountIdentifier: row.accountIdentifier || null,
                categoryId: match.categoryId || row.categoryId || null,
                merchantId: match.merchantId || row.merchantId || null,
                notes: row.notes || null,
                importId,
                rawCsvJson: JSON.stringify(row.rawCsvJson || row),
            },
        });
        created.push(transaction);
    }
    return { created, duplicates };
};
exports.parseAndStoreTransactions = parseAndStoreTransactions;
