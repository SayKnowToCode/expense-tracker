/**
 * Verification script for the CSV re-upload dedup contract.
 *
 * Run with:
 *   cd backend && npx ts-node scripts/verify-dedupe.ts
 *
 * What it proves:
 *   1. Re-uploading the exact same statement is a no-op.
 *   2. A later statement that overlaps with the first only inserts the
 *      new rows.
 *   3. Same-day repeat transactions (identical date/amount/description,
 *      no reference number) are preserved across uploads.
 *   4. Cosmetic differences across uploads (whitespace, casing,
 *      "Cr"/"credit", commas in amount, timestamp on the date) don't
 *      cause false re-inserts.
 *
 * The script writes a throwaway SQLite database under
 * `backend/scripts/.verify-dedupe.db` and deletes it on success.
 */

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';

const DB_PATH = resolve(__dirname, '.verify-dedupe.db');
process.env.DATABASE_URL = `file:${DB_PATH}`;

// Apply migrations to the throwaway DB before importing Prisma client.
const repoRoot = resolve(__dirname, '..', '..');
try {
  execSync('npx prisma migrate deploy', {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
    stdio: 'inherit',
  });
} catch (err) {
  console.error('Failed to apply migrations. Did you run `npx prisma generate`?');
  throw err;
}

// Imported lazily so Prisma picks up DATABASE_URL above.
import { prisma } from '../src/db';
import { parseAndStoreTransactions } from '../src/services/importService';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  if (actual !== expected) {
    console.error(`FAIL  ${label}: expected ${String(expected)}, got ${String(actual)}`);
    process.exitCode = 1;
  } else {
    console.log(`ok    ${label}`);
  }
};

const upload = async (
  fileName: string,
  rows: any[],
): Promise<{ created: number; duplicates: number }> => {
  const imp = await prisma.import.create({
    data: { fileName, originalCsv: '', summary: '' },
  });
  const res = await parseAndStoreTransactions(rows, imp.id);
  return { created: res.created.length, duplicates: res.duplicates.length };
};

const main = async () => {
  // Clean slate in case the file existed before.
  await prisma.transaction.deleteMany({});
  await prisma.import.deleteMany({});

  // --- Statement #1: dates 1-10, includes two same-day ₹50 coffees on the 5th
  const statement1 = [
    { transactionDate: '2026-01-01', amount: 1000, debitOrCredit: 'credit', description: 'Salary',  referenceNumber: 'TXN001' },
    { transactionDate: '2026-01-03', amount:  250, debitOrCredit: 'debit',  description: 'Groceries', referenceNumber: 'TXN002' },
    { transactionDate: '2026-01-05', amount:   50, debitOrCredit: 'debit',  description: 'Coffee',    referenceNumber: null },
    { transactionDate: '2026-01-05', amount:   50, debitOrCredit: 'debit',  description: 'Coffee',    referenceNumber: null },
    { transactionDate: '2026-01-10', amount:  120, debitOrCredit: 'debit',  description: 'Lunch',     referenceNumber: 'TXN003' },
  ];
  const r1 = await upload('statement-jan-10.csv', statement1);
  assertEq('first upload created', r1.created, 5);
  assertEq('first upload duplicates', r1.duplicates, 0);
  assertEq('total rows after #1', await prisma.transaction.count(), 5);

  // --- Statement #2: same statement re-uploaded with cosmetic noise
  const statement1Noisy = [
    { transactionDate: '2026-01-01T10:00:00Z', amount: '1,000.00', debitOrCredit: 'Cr',     description: '  Salary  ',   referenceNumber: 'TXN001' },
    { transactionDate: '2026-01-03',           amount: '250.00',   debitOrCredit: 'DEBIT',  description: 'GROCERIES',    referenceNumber: 'TXN002' },
    { transactionDate: '2026-01-05',           amount: 50,         debitOrCredit: 'debit',  description: 'coffee',       referenceNumber: '' },
    { transactionDate: '2026-01-05',           amount: 50,         debitOrCredit: 'debit',  description: 'coffee',       referenceNumber: '' },
    { transactionDate: '2026-01-10',           amount: 120,        debitOrCredit: 'debit',  description: 'Lunch',        referenceNumber: 'TXN003' },
  ];
  const r2 = await upload('statement-jan-10-reupload.csv', statement1Noisy);
  assertEq('re-upload created', r2.created, 0);
  assertEq('re-upload duplicates', r2.duplicates, 5);
  assertEq('total rows after #2', await prisma.transaction.count(), 5);

  // --- Statement #3: covers 1-20, contains everything in #1 plus
  //     a third identical coffee on the 5th (legit repeat) and new rows on 12-20.
  const statement3 = [
    ...statement1,
    { transactionDate: '2026-01-05', amount:   50, debitOrCredit: 'debit',  description: 'Coffee',    referenceNumber: null },
    { transactionDate: '2026-01-12', amount:  800, debitOrCredit: 'debit',  description: 'Rent',      referenceNumber: 'TXN004' },
    { transactionDate: '2026-01-17', amount:   30, debitOrCredit: 'debit',  description: 'Coffee',    referenceNumber: null },
    { transactionDate: '2026-01-20', amount:  500, debitOrCredit: 'credit', description: 'Refund',    referenceNumber: 'TXN005' },
  ];
  const r3 = await upload('statement-jan-20.csv', statement3);
  // Expected new: the third coffee on the 5th + 3 brand-new rows.
  assertEq('statement #3 created', r3.created, 4);
  assertEq('statement #3 duplicates', r3.duplicates, 5);
  assertEq('total rows after #3', await prisma.transaction.count(), 9);

  // --- Statement #4: full-month re-pull. Nothing new happened on the
  //     bank side, so re-uploading must be a complete no-op even though
  //     the rows arrive interleaved differently.
  const r4 = await upload('statement-jan-30.csv', [...statement3].reverse());
  assertEq('full re-pull created', r4.created, 0);
  assertEq('full re-pull duplicates', r4.duplicates, 9);
  assertEq('total rows after #4', await prisma.transaction.count(), 9);

  // --- Statement #5: a fourth identical ₹50 coffee really happened on
  //     the 5th. Only that one new row should be added.
  const r5 = await upload('statement-feb-01.csv', [
    ...statement3,
    { transactionDate: '2026-01-05', amount: 50, debitOrCredit: 'debit', description: 'Coffee', referenceNumber: null },
  ]);
  assertEq('extra same-day repeat created', r5.created, 1);
  assertEq('extra same-day repeat duplicates', r5.duplicates, 9);
  assertEq('total rows after #5', await prisma.transaction.count(), 10);

  await prisma.$disconnect();
};

main()
  .then(() => {
    if (existsSync(DB_PATH)) {
      try { unlinkSync(DB_PATH); } catch {}
      try { unlinkSync(`${DB_PATH}-journal`); } catch {}
    }
    if (process.exitCode && process.exitCode !== 0) {
      console.error('\nverify-dedupe: FAILED');
    } else {
      console.log('\nverify-dedupe: all checks passed');
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
