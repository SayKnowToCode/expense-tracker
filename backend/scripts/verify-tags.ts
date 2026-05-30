/**
 * Tag + category round-trip smoke check.
 *
 * Usage:
 *   BASE_URL=http://localhost:4000 npx ts-node --transpile-only scripts/verify-tags.ts
 *
 * Assumes the backend is already running against a DB that has at
 * least one transaction (run `verify-real-csv.ts` first).
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';

const die = (msg: string) => {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
};
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

const ok = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) die(`${label}: expected ${e}, got ${a}`);
  console.log(`ok    ${label}`);
};

interface Tx {
  id: number;
  description: string;
  categoryId: number | null;
  category: { id: number; name: string } | null;
  tags: { id: number; name: string }[];
}

interface TagResp {
  transaction: Tx;
  appliedToAll: { merchantKey: string; backfilled: number } | null;
}

const main = async () => {
  const all = await get<Tx[]>('/api/transactions');
  if (all.length < 3) die(`Need at least 3 transactions, got ${all.length}`);
  const [a, b, c] = all;

  console.log('Tagging 3 transactions…');

  const u1 = await put<TagResp>(`/api/transactions/${a.id}/tags`, { tags: ['food', 'breakfast'] });
  ok(
    'a.tags after first PUT',
    u1.transaction.tags.map((t) => t.name).sort(),
    ['breakfast', 'food'],
  );

  const u1b = await put<TagResp>(`/api/transactions/${a.id}/tags`, { tags: ['food', 'office-lunch'] });
  ok(
    'a.tags after replace PUT',
    u1b.transaction.tags.map((t) => t.name).sort(),
    ['food', 'office-lunch'],
  );

  await put<TagResp>(`/api/transactions/${b.id}/tags`, { tags: ['transport'] });
  await put<TagResp>(`/api/transactions/${c.id}/tags`, { tags: ['food', 'subscription'] });

  console.log('Creating category and assigning…');
  const cat = await post<{ id: number; name: string }>('/api/categories', { name: 'food' });
  const u2 = await put<TagResp>(`/api/transactions/${a.id}/category`, { categoryId: cat.id });
  ok('a.category after assign', u2.transaction.category?.name, 'food');

  const u3 = await put<TagResp>(`/api/transactions/${a.id}/category`, { categoryId: null });
  ok('a.category after clear', u3.transaction.category, null);

  const tags = await get<{ name: string }[]>('/api/tags');
  const names = tags.map((t) => t.name).sort();
  console.log('Tag library:', names);
  for (const required of ['food', 'office-lunch', 'transport', 'subscription']) {
    if (!names.includes(required)) die(`Tag library missing "${required}"`);
  }

  const fresh = await get<Tx[]>(`/api/transactions`);
  // We assert per-tag presence rather than total-tagged-count because
  // earlier verifications may have created AutoTagRules that
  // backfilled additional rows with their own tags. That's expected
  // and good; we only care that the three rows we just tagged are
  // still carrying the expected tag sets.
  const A = fresh.find((t) => t.id === a.id)!;
  const B = fresh.find((t) => t.id === b.id)!;
  const C = fresh.find((t) => t.id === c.id)!;
  const has = (t: Tx, name: string) => (t.tags || []).some((x) => x.name === name);
  if (!has(A, 'food') || !has(A, 'office-lunch')) die('A missing food/office-lunch');
  if (!has(B, 'transport')) die('B missing transport');
  if (!has(C, 'food') || !has(C, 'subscription')) die('C missing food/subscription');
  console.log('ok    a/b/c carry the expected tags after refresh');

  console.log('\nverify-tags: all checks passed');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
