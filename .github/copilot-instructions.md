# Copilot / Agent Instructions for `expense-tracker`

## Project at a glance

`expense-tracker` is a self-hosted personal finance tool. The user uploads
CSV exports of bank / credit-card statements, and the app categorizes,
tags, and visualizes the transactions.

- **Backend:** Node.js + Express + TypeScript + Prisma 7 + SQLite.
  Source lives in `backend/src`; build output goes to `backend/dist`.
- **Frontend:** Vite + React 19 + TypeScript, in `frontend/`. Uses
  `recharts` for analytics visualizations and `react-router-dom` for
  navigation. The dev server proxies `/api/*` → `http://localhost:4000`.
- **DB schema:** `prisma/schema.prisma`. Migrations in `prisma/migrations/`.
- **Generated Prisma client:** emitted to `backend/src/generated/prisma`
  by `prisma generate` and is **not** checked in. Always go through
  the singleton in `backend/src/db.ts`; never call `new PrismaClient()`
  directly (Prisma 7 requires a driver adapter).

## Core domain rules

1. **CSV imports must be idempotent across re-uploads.** Users typically
   re-download statements on the 10th, 20th and end of every month, so
   each new file overlaps with previous ones.
   - Re-uploading the exact same statement is a no-op (zero new
     transactions, zero errors).
   - A later, longer statement that contains previous rows plus new ones
     only inserts the new rows.
   - Legitimate same-day repeat transactions (e.g. two identical ₹50
     coffees on the same day with no reference number) are **preserved**;
     they don't get collapsed.

   The implementation lives in
   `backend/src/services/importService.ts` and uses a
   `baseFingerprint` + `occurrenceIndex` pair per transaction
   (`backend/src/utils/fingerprint.ts`). The pair is enforced unique at
   the DB level. Any change to import / dedup behavior **must** keep all
   three guarantees above.

2. **Categories, merchants, tags, and merchant rules are user-managed
   metadata.** They must never participate in duplicate detection or
   identity comparisons.

3. **The `rawCsvJson` column** stores the original row exactly as it
   came from the bank, so we can re-derive any future field without
   asking the user to re-upload.

4. **Every transaction has a `merchantKey`.** This is the canonical
   "what merchant is this" string derived from the noisy bank
   narration (e.g. `UPI-UDUPI FOOD PARK-GPAY-...` → `UDUPI FOOD PARK`).
   The extractor lives in `backend/src/utils/merchantKey.ts` and is
   the only function allowed to compute the key — keep it the single
   source of truth so the importer, backfill endpoint, and any future
   tooling stay in agreement.

5. **AutoTagRule / AutoCategoryRule are the user's "tag once, apply
   forever" contract.** They are keyed by `merchantKey` and are
   created from the Transactions page via the
   "Apply changes to all N transactions from <merchantKey>" toggle.
   - Creating a rule **must** backfill every existing matching
     transaction synchronously (see
     `backend/src/services/autoRulesService.ts`).
   - The CSV importer **must** call `applyRulesToTransaction` after
     every successful insert so newly imported rows pick up existing
     rules.
   - Rule creation is idempotent: re-creating the same rule is a no-op
     that returns `backfilled: 0`.

## Conventions

- Always import the Prisma client from
  `../generated/prisma/client` (the project uses Prisma 7's
  `prisma-client` generator, not `@prisma/client`).
- Controllers stay thin; non-trivial logic belongs in
  `backend/src/services/`.
- New API routes must be mounted under `/api/...` exactly once in
  `backend/src/index.ts`.
- Use `try/catch` in any controller that touches the DB and return
  structured JSON errors (`{ error: "..." }`).
- Don't commit `backend/dist`, `backend/src/generated`, `*.db`, or
  `.env`.

## Local setup

```bash
cp .env.example .env
cd backend && npm install
npx prisma migrate deploy        # creates ./prisma/dev.db
npx prisma generate              # writes backend/src/generated/prisma
npm run dev                      # http://localhost:4000
```

## Verifying the contracts

All scripts live in `backend/scripts/` and either spin up their own
fresh state (`verify-dedupe`) or run against a live backend on
`BASE_URL` (default `http://localhost:4000`).

```bash
cd backend
# Idempotent import contract (self-contained).
npx ts-node scripts/verify-dedupe.ts

# The next three need a running backend on :4000 (`npm run dev`) and
# the user's HDFC CSV at $CSV_PATH.
BASE_URL=http://localhost:4000 \
  CSV_PATH=/path/to/Acct\ Statement.csv \
  npx ts-node --transpile-only scripts/verify-real-csv.ts
BASE_URL=http://localhost:4000 \
  npx ts-node --transpile-only scripts/verify-auto-rules.ts
BASE_URL=http://localhost:4000 \
  npx ts-node --transpile-only scripts/verify-tags.ts
```

`verify-auto-rules.ts` is the contract test for the "tag once, apply
forever" feature: it picks the busiest merchant in the loaded DB,
tags one of its rows with `applyToAllFromSameMerchant=true`, and
asserts every other row from the same merchant ends up tagged. Run it
after any change to `autoRulesService`, `transactionController`, or
the importer.
