/**
 * Auto-tag + auto-category rule verification against a live backend.
 *
 * Usage:
 *   BASE_URL=http://localhost:4000 \
 *     npx ts-node --transpile-only scripts/verify-auto-rules.ts
 *
 * Run AFTER `verify-real-csv.ts` so the DB has the user's actual
 * 599-row HDFC statement loaded. This script picks the busiest
 * merchant (UDUPI FOOD PARK in the sample) and exercises:
 *   1. Tagging one transaction with applyToAllFromSameMerchant=true
 *      tags every other transaction from the same merchant.
 *   2. Categorizing one transaction with applyToAllFromSameMerchant=true
 *      categorizes every other transaction from the same merchant.
 *   3. The /api/analytics endpoints surface the new groupings.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';

const die = (msg: string) => { console.error(`FAIL  ${msg}`); process.exit(1); };
const get = async <T,>(p: string): Promise<T> => {
  const r = await fetch(`${BASE_URL}${p}`);
  if (!r.ok) die(`GET ${p} → ${r.status}: ${await r.text()}`);
  return r.json();
};
const put = async <T,>(p: string, body: unknown): Promise<T> => {
  const r = await fetch(`${BASE_URL}${p}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) die(`PUT ${p} → ${r.status}: ${await r.text()}`);
  return r.json();
};
const post = async <T,>(p: string, body: unknown): Promise<T> => {
  const r = await fetch(`${BASE_URL}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) die(`POST ${p} → ${r.status}: ${await r.text()}`);
  return r.json();
};

const ok = (label: string, cond: boolean, extra?: string) => {
  if (!cond) die(`${label}${extra ? ': ' + extra : ''}`);
  console.log(`ok    ${label}`);
};

interface Tx {
  id: number;
  description: string;
  merchantKey: string;
  category: { id: number; name: string } | null;
  tags: { id: number; name: string }[];
}

const main = async () => {
  const all = await get<Tx[]>('/api/transactions');
  console.log(`DB has ${all.length} transactions.`);
  if (all.length === 0) die('Need transactions; run verify-real-csv.ts first.');

  // Pick the merchantKey with the most transactions.
  const counts = new Map<string, Tx[]>();
  for (const t of all) {
    const arr = counts.get(t.merchantKey) ?? [];
    arr.push(t);
    counts.set(t.merchantKey, arr);
  }
  const [busiestKey, busiestList] = [...counts.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];
  console.log(`Busiest merchant: "${busiestKey}" (${busiestList.length} transactions)`);
  ok('merchantKey is non-empty', busiestKey.length > 0);

  const target = busiestList[0];
  console.log(`Tagging txn #${target.id} as "udupi" with applyToAllFromSameMerchant=true…`);
  const tagRes = await put<{
    transaction: Tx;
    appliedToAll: { merchantKey: string; backfilled: number } | null;
  }>(`/api/transactions/${target.id}/tags`, {
    tags: ['udupi'],
    applyToAllFromSameMerchant: true,
  });
  ok('tag PUT returned applyToAll', tagRes.appliedToAll !== null);
  ok(
    `appliedToAll.backfilled covers other ${busiestList.length - 1} rows`,
    tagRes.appliedToAll!.backfilled === busiestList.length - 1,
    `expected ${busiestList.length - 1}, got ${tagRes.appliedToAll!.backfilled}`,
  );

  const afterTag = await get<Tx[]>('/api/transactions');
  const tagged = afterTag.filter((t) =>
    (t.tags || []).some((x) => x.name === 'udupi'),
  );
  ok(
    `all ${busiestList.length} transactions of "${busiestKey}" now carry "udupi"`,
    tagged.length === busiestList.length,
    `expected ${busiestList.length}, got ${tagged.length}`,
  );

  console.log('Creating "food" category and applying it across the same merchant…');
  const cat = await post<{ id: number; name: string }>('/api/categories', {
    name: 'food',
  });
  const catRes = await put<{
    transaction: Tx;
    appliedToAll: { merchantKey: string; backfilled: number } | null;
  }>(`/api/transactions/${target.id}/category`, {
    categoryId: cat.id,
    applyToAllFromSameMerchant: true,
  });
  ok('category PUT returned applyToAll', catRes.appliedToAll !== null);
  ok(
    `appliedToAll.backfilled covers other ${busiestList.length - 1} rows`,
    catRes.appliedToAll!.backfilled === busiestList.length - 1,
    `expected ${busiestList.length - 1}, got ${catRes.appliedToAll!.backfilled}`,
  );

  const afterCat = await get<Tx[]>('/api/transactions');
  const inCat = afterCat.filter((t) => t.category?.id === cat.id);
  ok(
    `all ${busiestList.length} transactions of "${busiestKey}" are in "food"`,
    inCat.length === busiestList.length,
    `expected ${busiestList.length}, got ${inCat.length}`,
  );

  console.log('Checking analytics endpoints…');
  const byTag = await get<{ label: string; totalAmount: number; transactionCount: number }[]>(
    '/api/analytics/by-tag',
  );
  const udupiBucket = byTag.find((b) => b.label === 'udupi');
  ok('udupi tag appears in by-tag analytics', udupiBucket !== undefined);
  ok(
    'udupi tag count matches',
    udupiBucket!.transactionCount === busiestList.length,
    `expected ${busiestList.length}, got ${udupiBucket!.transactionCount}`,
  );

  const byMerchant = await get<{ label: string; totalAmount: number; transactionCount: number }[]>(
    '/api/analytics/by-merchant?limit=5',
  );
  ok(
    `${busiestKey} is in the top 5 by spend`,
    byMerchant.some((b) => b.label === busiestKey),
  );

  const byCat = await get<{ label: string; totalAmount: number; transactionCount: number }[]>(
    '/api/analytics/by-category',
  );
  const foodBucket = byCat.find((b) => b.label === 'food');
  ok('food category appears in by-category analytics', foodBucket !== undefined);

  const daily = await get<{ date: string; spend: number; income: number }[]>(
    '/api/analytics/daily',
  );
  ok('daily series returned at least 1 point', daily.length > 0);

  const summary = await get<{
    avgDailySpend: number;
    daysCovered: number;
    transactionCount: number;
  }>('/api/analytics/summary');
  ok('summary.daysCovered > 0', summary.daysCovered > 0);
  ok('summary.avgDailySpend > 0', summary.avgDailySpend > 0);
  console.log('Summary:', summary);

  // ---- Idempotency: re-running with the same rule shouldn't error.
  const again = await put<{
    appliedToAll: { backfilled: number } | null;
  }>(`/api/transactions/${target.id}/tags`, {
    tags: ['udupi'],
    applyToAllFromSameMerchant: true,
  });
  ok(
    're-applying same rule backfills 0 new rows',
    again.appliedToAll?.backfilled === 0,
    `got ${again.appliedToAll?.backfilled}`,
  );

  console.log('\nverify-auto-rules: all checks passed');
};

main().catch((e) => { console.error(e); process.exit(1); });
