# Copilot / Agent Instructions for `expense-tracker`

## Project at a glance

`expense-tracker` is a self-hosted personal finance tool. The user uploads
CSV exports of bank / credit-card statements, and the app categorizes,
tags, and visualizes the transactions.

- **Backend:** Node.js + Express + TypeScript + Prisma + SQLite. Source
  lives in `backend/src`; build output goes to `backend/dist`.
- **Frontend:** Vite + React 19 + TypeScript, in `frontend/`.
- **DB schema:** `prisma/schema.prisma`. Migrations in `prisma/migrations/`.
- **Generated Prisma client:** emitted to `backend/src/generated/prisma`
  by `prisma generate` and is **not** checked in.

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

## Verifying the re-upload contract

After any change to import / dedup code, run:

```bash
cd backend && npx ts-node scripts/verify-dedupe.ts
```

The script spins up a fresh SQLite DB, simulates three overlapping
statement uploads, and asserts the transaction count matches the
expected idempotent behavior. It exits non-zero on any regression.
