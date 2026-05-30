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

const main = async () => {
  const all = await get<Tx[]>('/api/transactions');
  if (all.length < 3) die(`Need at least 3 transactions, got ${all.length}`);
  const [a, b, c] = all;

  console.log('Tagging 3 transactions…');

  const u1 = await put<Tx>(`/api/transactions/${a.id}/tags`, { tags: ['food', 'breakfast'] });
  ok(
    'a.tags after first PUT',
    u1.tags.map((t) => t.name).sort(),
    ['breakfast', 'food'],
  );

  const u1b = await put<Tx>(`/api/transactions/${a.id}/tags`, { tags: ['food', 'office-lunch'] });
  ok(
    'a.tags after replace PUT',
    u1b.tags.map((t) => t.name).sort(),
    ['food', 'office-lunch'],
  );

  await put<Tx>(`/api/transactions/${b.id}/tags`, { tags: ['transport'] });
  await put<Tx>(`/api/transactions/${c.id}/tags`, { tags: ['food', 'subscription'] });

  console.log('Creating category and assigning…');
  const cat = await post<{ id: number; name: string }>('/api/categories', { name: 'food' });
  const u2 = await put<Tx>(`/api/transactions/${a.id}/category`, { categoryId: cat.id });
  ok('a.category after assign', u2.category?.name, 'food');

  const u3 = await put<Tx>(`/api/transactions/${a.id}/category`, { categoryId: null });
  ok('a.category after clear', u3.category, null);

  const tags = await get<{ name: string }[]>('/api/tags');
  const names = tags.map((t) => t.name).sort();
  console.log('Tag library:', names);
  for (const required of ['food', 'office-lunch', 'transport', 'subscription']) {
    if (!names.includes(required)) die(`Tag library missing "${required}"`);
  }

  const fresh = await get<Tx[]>(`/api/transactions`);
  const tagged = fresh.filter((t) => (t.tags || []).length > 0).length;
  if (tagged !== 3) die(`Expected 3 tagged transactions, got ${tagged}`);
  console.log(`ok    ${tagged} transactions have at least one tag after refresh`);

  console.log('\nverify-tags: all checks passed');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
