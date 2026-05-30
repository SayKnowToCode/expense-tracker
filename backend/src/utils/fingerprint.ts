import { createHash } from 'crypto';

/**
 * A subset of a parsed CSV row used for identity comparison.
 * Only the fields that uniquely identify a real-world bank transaction
 * are included; everything else (category, tags, merchant, etc.) is
 * derived state and must not influence the fingerprint.
 */
export interface FingerprintInput {
  transactionDate: Date | string;
  amount: number | string;
  debitOrCredit?: string | null;
  description?: string | null;
  referenceNumber?: string | null;
}

/**
 * Convert any reasonable representation of a transaction date into a
 * day-precision ISO string (YYYY-MM-DD). Time-of-day is intentionally
 * dropped because bank statements rarely include it and, when they do,
 * different statements for the same row can disagree on the timestamp.
 */
export const normalizeDate = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid transactionDate: ${String(value)}`);
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeAmount = (value: number | string): string => {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid amount: ${String(value)}`);
  }
  // Round to 2dp to absorb floating-point noise across re-uploads.
  return n.toFixed(2);
};

export const normalizeDebitOrCredit = (value?: string | null): string => {
  const v = (value || '').trim().toLowerCase();
  if (v === 'cr' || v === 'credit' || v === '+') return 'credit';
  if (v === 'dr' || v === 'debit' || v === '-') return 'debit';
  return v || 'debit';
};

const collapseWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

export const normalizeDescription = (value?: string | null): string =>
  collapseWhitespace(String(value || '')).toLowerCase();

export const normalizeReference = (value?: string | null): string =>
  collapseWhitespace(String(value || '')).toLowerCase();

/**
 * Build a stable hash for a transaction row that is identical across
 * re-uploads of the same bank statement, regardless of cosmetic
 * formatting differences (whitespace, casing, comma in amount, time of
 * day on the date column, "Cr"/"credit" variations).
 *
 * Two rows that share this fingerprint are treated as the same
 * real-world transaction by the importer. To handle legitimate same-day
 * repeats (e.g. two identical coffee purchases) we additionally track
 * `occurrenceIndex` per fingerprint, see `dedupe-importer.ts`.
 */
export const baseFingerprint = (row: FingerprintInput): string => {
  const parts = [
    normalizeDate(row.transactionDate),
    normalizeAmount(row.amount),
    normalizeDebitOrCredit(row.debitOrCredit),
    normalizeDescription(row.description),
    normalizeReference(row.referenceNumber),
  ].join('|');
  return createHash('sha256').update(parts).digest('hex');
};
