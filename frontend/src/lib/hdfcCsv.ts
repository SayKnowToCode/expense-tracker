import Papa from 'papaparse';
import type { ParsedTransactionRow } from '../api/client';

/**
 * Parser for the HDFC personal bank-statement CSV export.
 *
 * That format is annoying:
 *   - 1-3 separator rows of `****…****` at the top and bottom.
 *   - The actual header row is:
 *       Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
 *     followed by another `****…****` row directly under it.
 *   - `Date` is `DD/MM/YY`.
 *   - Each row has exactly ONE of `Withdrawal Amt.` / `Deposit Amt.` populated.
 *   - `Chq./Ref.No.` has 16-digit values with leading zeros, but
 *     bank-internal rows (interest, reversals) use a sentinel of all
 *     zeros — we treat those as having no reference at all so the
 *     dedup hash falls back to date + amount + description.
 *   - Some rows are wrapped in quotes because the description contains
 *     a comma (e.g. `"ME DC SI ... CURSOR, AI POWERED IDE"`). PapaParse
 *     handles this for us.
 *
 * We deliberately keep the parser format-specific and small instead of
 * trying to be a generic CSV mapper, so users get clear errors instead
 * of silently mis-parsed data.
 */

export interface HdfcParseResult {
  rows: ParsedTransactionRow[];
  skipped: number;
  warnings: string[];
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

const isSeparatorRow = (row: string[]): boolean =>
  row.every((c) => /^\**$/.test((c || '').trim()));

const isHeaderRow = (row: string[]): boolean =>
  row.length >= EXPECTED_HEADERS.length &&
  EXPECTED_HEADERS.every((h, i) => (row[i] || '').trim() === h);

const isEmptyRow = (row: string[]): boolean =>
  row.every((c) => !(c || '').trim());

/**
 * Parse `DD/MM/YY` into a YYYY-MM-DD ISO date string.
 * Two-digit years are assumed to be in the 2000-2099 range, matching
 * the bank's own convention.
 */
const parseHdfcDate = (raw: string): string => {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Unrecognized date: "${raw}"`);
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yRaw = m[3];
  const yyyy = yRaw.length === 2 ? `20${yRaw}` : yRaw.padStart(4, '0');
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
  // Strip leading zeros. A reference that is *only* zeros (bank
  // internal sentinel) becomes empty → null, which makes the dedup
  // hash fall back to date+amount+description.
  const stripped = trimmed.replace(/^0+/, '');
  return stripped || null;
};

export const parseHdfcCsv = (csv: string): HdfcParseResult => {
  const warnings: string[] = [];
  const { data, errors } = Papa.parse<string[]>(csv, {
    header: false,
    skipEmptyLines: false,
  });
  for (const e of errors) {
    warnings.push(`Papa: ${e.message} (row ${e.row ?? '?'})`);
  }

  let headerIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (isHeaderRow(data[i])) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    throw new Error(
      'Could not find the HDFC header row (expected: ' +
        EXPECTED_HEADERS.join(', ') +
        ').',
    );
  }

  const rows: ParsedTransactionRow[] = [];
  let skipped = 0;

  for (let i = headerIndex + 1; i < data.length; i++) {
    const cells = data[i];
    if (isEmptyRow(cells) || isSeparatorRow(cells)) {
      skipped++;
      continue;
    }

    const [date, narration, ref, , withdrawal, deposit] = cells;

    let isoDate: string;
    try {
      isoDate = parseHdfcDate(date || '');
    } catch (err: any) {
      warnings.push(`Row ${i + 1}: ${err.message}`);
      skipped++;
      continue;
    }

    const withdrawalAmt = parseAmount(withdrawal || '');
    const depositAmt = parseAmount(deposit || '');

    let debitOrCredit: 'debit' | 'credit';
    let amount: number;
    if (withdrawalAmt != null && withdrawalAmt > 0) {
      debitOrCredit = 'debit';
      amount = withdrawalAmt;
    } else if (depositAmt != null && depositAmt > 0) {
      debitOrCredit = 'credit';
      amount = depositAmt;
    } else {
      warnings.push(`Row ${i + 1}: neither withdrawal nor deposit amount`);
      skipped++;
      continue;
    }

    const rawCsvJson: Record<string, string> = {};
    EXPECTED_HEADERS.forEach((h, idx) => {
      rawCsvJson[h] = cells[idx] ?? '';
    });

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
