/**
 * End-to-end smoke check: parse a real HDFC bank-statement CSV (same
 * logic the React frontend uses), POST it to a live backend, then POST
 * it AGAIN and assert nothing got duplicated.
 *
 * Usage:
 *   BASE_URL=http://localhost:4101 CSV_PATH=/path/to/file.csv \
 *     npx ts-node --transpile-only scripts/verify-real-csv.ts
 *
 * The parsing logic is duplicated from frontend/src/lib/hdfcCsv.ts on
 * purpose: backend is CommonJS, frontend is ESM, and the two can't
 * import each other cleanly under ts-node. Both copies must stay in
 * sync — see `.github/copilot-instructions.md`.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Papa from 'papaparse';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4101';
const CSV_PATH = process.env.CSV_PATH;

if (!CSV_PATH) {
  console.error('Set CSV_PATH to the absolute path of an HDFC bank-statement CSV.');
  process.exit(1);
}

const EXPECTED_HEADERS = [
  'Date',
  'Narration',
  'Chq./Ref.No.',
  'Value Dt',
  'Withdrawal Amt.',
  'Deposit Amt.',
  'Closing Balance',
];

interface ParsedRow {
  transactionDate: string;
  amount: number;
  debitOrCredit: 'debit' | 'credit';
  description: string;
  referenceNumber: string | null;
  rawCsvJson: Record<string, string>;
}

const isSeparatorRow = (row: string[]) =>
  row.every((c) => /^\**$/.test((c || '').trim()));
const isHeaderRow = (row: string[]) =>
  row.length >= EXPECTED_HEADERS.length &&
  EXPECTED_HEADERS.every((h, i) => (row[i] || '').trim() === h);
const isEmptyRow = (row: string[]) => row.every((c) => !(c || '').trim());

const parseHdfcDate = (raw: string): string => {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Unrecognized date: "${raw}"`);
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3].padStart(4, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseAmount = (raw: string): number | null => {
  const trimmed = (raw || '').replace(/,/g, '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

const normalizeReference = (raw: string): string | null => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^0+/, '');
  return stripped || null;
};

const parseHdfcCsv = (csv: string): { rows: ParsedRow[]; skipped: number; warnings: string[] } => {
  const warnings: string[] = [];
  const { data } = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: false });
  let headerIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (isHeaderRow(data[i])) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) throw new Error('Could not find HDFC header row');

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (let i = headerIndex + 1; i < data.length; i++) {
    const cells = data[i];
    if (isEmptyRow(cells) || isSeparatorRow(cells)) { skipped++; continue; }
    const [date, narration, ref, , withdrawal, deposit] = cells;
    let isoDate: string;
    try { isoDate = parseHdfcDate(date || ''); } catch (e: any) {
      warnings.push(`Row ${i + 1}: ${e.message}`); skipped++; continue;
    }
    const w = parseAmount(withdrawal || '');
    const d = parseAmount(deposit || '');
    let debitOrCredit: 'debit' | 'credit'; let amount: number;
    if (w != null && w > 0) { debitOrCredit = 'debit'; amount = w; }
    else if (d != null && d > 0) { debitOrCredit = 'credit'; amount = d; }
    else { warnings.push(`Row ${i + 1}: neither withdrawal nor deposit`); skipped++; continue; }
    const rawCsvJson: Record<string, string> = {};
    EXPECTED_HEADERS.forEach((h, idx) => { rawCsvJson[h] = cells[idx] ?? ''; });
    rows.push({
      transactionDate: isoDate,
      amount,
      debitOrCredit,
      description: (narration || '').trim(),
      referenceNumber: normalizeReference(ref || ''),
      rawCsvJson,
    });
  }
  return { rows, skipped, warnings };
};

const die = (msg: string) => { console.error(`FAIL  ${msg}`); process.exit(1); };

const post = async (body: unknown) => {
  const res = await fetch(`${BASE_URL}/api/imports/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) die(`POST /api/imports/csv → ${res.status}: ${await res.text()}`);
  return res.json();
};
const get = async <T,>(path: string): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) die(`GET ${path} → ${res.status}`);
  return res.json();
};

const main = async () => {
  const csv = readFileSync(resolve(CSV_PATH), 'utf8');
  const parsed = parseHdfcCsv(csv);
  console.log(`Parsed ${parsed.rows.length} rows (${parsed.skipped} skipped).`);
  if (parsed.warnings.length) {
    console.log('Warnings:');
    for (const w of parsed.warnings) console.log(`  - ${w}`);
  }

  const u1 = await post({ fileName: 'first-upload.csv', originalCsv: csv, parsedRows: parsed.rows });
  console.log('Upload #1:', u1);
  if (u1.createdCount !== parsed.rows.length) die(`#1 created should be ${parsed.rows.length}, got ${u1.createdCount}`);
  if (u1.duplicateCount !== 0) die(`#1 duplicates should be 0, got ${u1.duplicateCount}`);

  const u2 = await post({ fileName: 'second-upload.csv', originalCsv: csv, parsedRows: parsed.rows });
  console.log('Upload #2:', u2);
  if (u2.createdCount !== 0) die(`#2 created should be 0, got ${u2.createdCount}`);
  if (u2.duplicateCount !== parsed.rows.length) die(`#2 duplicates should be ${parsed.rows.length}, got ${u2.duplicateCount}`);

  const txns = await get<unknown[]>('/api/transactions');
  if (txns.length !== parsed.rows.length) die(`Final txn count should be ${parsed.rows.length}, got ${txns.length}`);

  const summary = await get<{ totalIncome: number; totalExpenses: number; netSavings: number }>(
    '/api/analytics/summary',
  );
  console.log('Dashboard summary:', summary);

  console.log('\nverify-real-csv: all checks passed');
};

main().catch((err) => { console.error(err); process.exit(1); });
