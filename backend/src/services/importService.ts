import { prisma } from '../db';
import { matchMerchantRule } from './merchantRuleService';
import { baseFingerprint } from '../utils/fingerprint';

export interface ParsedTransactionRow {
  transactionDate: string | Date;
  amount: number | string;
  debitOrCredit?: string;
  description?: string;
  referenceNumber?: string | null;
  merchantIdentifier?: string | null;
  accountIdentifier?: string | null;
  categoryId?: number | null;
  merchantId?: number | null;
  notes?: string | null;
  rawCsvJson?: unknown;
}

export interface ImportResult {
  created: any[];
  duplicates: ParsedTransactionRow[];
}

/**
 * Idempotent CSV importer.
 *
 * Users typically download fresh statements on the 10th / 20th / end of
 * the month, so each new upload overlaps with previous ones. We must
 * therefore guarantee:
 *
 *   1. Re-uploading the exact same statement is a no-op (no duplicates,
 *      no errors).
 *   2. A later, longer statement that contains all previous rows plus
 *      newer ones only inserts the newer rows.
 *   3. Genuine same-day repeat transactions (e.g. two ₹50 coffees on the
 *      same date, no reference number) are preserved across uploads —
 *      they don't get collapsed into one.
 *
 * Algorithm:
 *   - Group incoming rows by their `baseFingerprint`.
 *   - For each group, look up how many transactions with that same
 *     fingerprint already exist in the DB (`existingCount`).
 *   - Insert `max(0, batchCount - existingCount)` new rows; mark the
 *     rest as duplicates. New rows get monotonically increasing
 *     `occurrenceIndex` values starting at `existingCount`, which the
 *     composite unique index `(baseFingerprint, occurrenceIndex)`
 *     enforces.
 */
export const parseAndStoreTransactions = async (
  parsedRows: ParsedTransactionRow[],
  importId: number,
): Promise<ImportResult> => {
  const created: any[] = [];
  const duplicates: ParsedTransactionRow[] = [];

  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    return { created, duplicates };
  }

  const groups = new Map<string, ParsedTransactionRow[]>();
  for (const row of parsedRows) {
    let fp: string;
    try {
      fp = baseFingerprint(row);
    } catch {
      // Malformed row (bad date / amount). Skip silently so one bad
      // line never aborts the whole import.
      duplicates.push(row);
      continue;
    }
    const bucket = groups.get(fp);
    if (bucket) bucket.push(row);
    else groups.set(fp, [row]);
  }

  for (const [fp, rows] of groups) {
    const existingCount = await prisma.transaction.count({
      where: { baseFingerprint: fp },
    });
    const toInsertCount = Math.max(0, rows.length - existingCount);
    const toInsert = rows.slice(0, toInsertCount);
    const toSkip = rows.slice(toInsertCount);

    for (let i = 0; i < toInsert.length; i++) {
      const row = toInsert[i];
      const occurrenceIndex = existingCount + i;
      const match = await matchMerchantRule(String(row.description || ''));
      try {
        const transaction = await prisma.transaction.create({
          data: {
            transactionDate: new Date(row.transactionDate),
            amount: Number(row.amount),
            debitOrCredit: row.debitOrCredit || 'debit',
            description: row.description || '',
            referenceNumber: row.referenceNumber || null,
            merchantIdentifier: row.merchantIdentifier || null,
            accountIdentifier: row.accountIdentifier || null,
            categoryId: match.categoryId ?? row.categoryId ?? null,
            merchantId: match.merchantId ?? row.merchantId ?? null,
            notes: row.notes || null,
            importId,
            rawCsvJson: JSON.stringify(row.rawCsvJson ?? row),
            baseFingerprint: fp,
            occurrenceIndex,
          },
        });
        created.push(transaction);
      } catch (err: any) {
        // Race: a concurrent import inserted the same (fp, idx). Treat
        // as duplicate so we never crash a long-running import.
        if (err?.code === 'P2002') {
          duplicates.push(row);
        } else {
          throw err;
        }
      }
    }

    for (const row of toSkip) duplicates.push(row);
  }

  return { created, duplicates };
};
