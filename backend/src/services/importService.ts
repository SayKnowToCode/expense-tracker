import { PrismaClient } from '../generated/prisma/client';
import { matchMerchantRule } from './merchantRuleService';

const prisma = new PrismaClient();

export const parseAndStoreTransactions = async (parsedRows: any[], importId: number) => {
  const created: any[] = [];
  const duplicates: any[] = [];
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
    const match = await matchMerchantRule(row.description || '');
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
