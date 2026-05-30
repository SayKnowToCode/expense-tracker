/**
 * Derive a stable "merchant key" from a raw bank-statement narration.
 *
 * The key is the unit users actually think about ("UDUPI FOOD PARK",
 * "NAMASTE HSR", "BURGER KING") rather than the noisy full narration
 * ("UPI-UDUPI FOOD PARK-GPAY-11259845017@OKBIZAXIS-UTIB0000553-
 * 116977637977-UPI"). It powers:
 *   - "Apply this tag/category to all transactions from <merchant>".
 *   - Spend-by-merchant analytics.
 *   - Future merchant-rule lookups during import.
 *
 * Two transactions with the same merchantKey are claimed by the user
 * to come from the same real-world counterparty. The function is
 * intentionally tolerant — it tries to do the right thing for the
 * common HDFC UPI format, then falls back to a normalized prefix for
 * anything weirder (NEFT, ACH, interest credits, card swipes).
 */

const NOISE_TOKENS = new Set(['UPI', 'AUTOPAY', 'UPIRET']);

/**
 * Normalize whitespace and casing so equivalent merchants collapse.
 */
const normalize = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/[^A-Z0-9 &@./]/g, ' ').replace(/\s+/g, ' ').trim();

const looksLikeReferenceId = (s: string) => /^[A-Z0-9]{6,}$/.test(s);

export const extractMerchantKey = (descriptionRaw: string): string => {
  const upper = (descriptionRaw || '').trim().toUpperCase();
  if (!upper) return 'UNKNOWN';

  // ---- UPI narrations ---------------------------------------------
  // Format: UPI-<MERCHANT>-<vpa>-<ifsc>-<txn id>-<note>
  // (sometimes prefixed with literal `AUTOPAY` between UPI and the merchant)
  if (upper.startsWith('UPI-')) {
    const parts = upper.slice(4).split('-');
    let i = 0;
    while (i < parts.length && NOISE_TOKENS.has(parts[i].trim())) i++;
    const merchant = normalize(parts[i] || '');
    if (merchant) return merchant;
  }

  // ---- UPI reversals: `UPIRET-20260518-109837279835` ---------------
  if (upper.startsWith('UPIRET')) return 'UPIRET (REVERSAL)';

  // ---- NEFT credits: `NEFT CR-SBIN0000562-MINAL-...-SBIN42600...` --
  if (upper.startsWith('NEFT')) {
    const parts = upper.split('-');
    // `NEFT CR-<ifsc>-<from>-<to>-<ref>` → use the sender as merchant
    if (parts.length >= 3) {
      const sender = normalize(parts[2]);
      if (sender) return `NEFT ${sender}`;
    }
    return 'NEFT';
  }

  // ---- ACH debits: `ACH D- INDIAN CLEARING CORP-0000C1KJ6REL` ------
  if (upper.startsWith('ACH ')) {
    const stripped = upper.replace(/-[A-Z0-9]{6,}$/, '');
    return normalize(stripped) || 'ACH';
  }

  // ---- Card POS, e.g.: `ME DC SI 435584XXXXXX0852 CURSOR, AI POWERED IDE`
  // The masked card slot is noise; the merchant follows it.
  const cardMatch = upper.match(/\b\d{6}X+\d{4}\b\s+(.+)$/);
  if (cardMatch) return normalize(cardMatch[1]);

  // ---- Generic: strip a trailing reference-id segment, return the rest.
  const lastDash = upper.lastIndexOf('-');
  if (lastDash > 0) {
    const suffix = upper.slice(lastDash + 1).trim();
    if (looksLikeReferenceId(suffix)) {
      return normalize(upper.slice(0, lastDash)) || 'UNKNOWN';
    }
  }

  // Last resort: normalize the whole thing and clip.
  const norm = normalize(upper);
  return norm.slice(0, 60) || 'UNKNOWN';
};
