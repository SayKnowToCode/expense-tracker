import path from 'path';
import dotenv from 'dotenv';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';

// Load the project-root .env explicitly. We can't rely on `dotenv/config`'s
// default behavior because the backend is started from the `backend/`
// directory, so it would otherwise look for `backend/.env` which doesn't
// exist. The same .env is consumed by `prisma migrate` (via
// prisma.config.ts at the repo root) so both ends agree.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Single shared Prisma client for the whole backend.
 *
 * Prisma 7 requires the constructor to be given a driver adapter; using
 * one client per file (as the original code did) breaks compilation and
 * also opens nine independent connection pools against the same SQLite
 * file. Importing this singleton instead avoids both problems.
 *
 * Path resolution: `prisma migrate deploy` (run from the repo root)
 * always creates the SQLite file at <repo-root>/prisma/dev.db. The
 * backend, however, is started from `backend/` and would otherwise
 * resolve a bare `file:./prisma/dev.db` from its own cwd
 * (`backend/prisma/dev.db`) — pointing at an empty, unmigrated
 * database. To avoid that footgun we resolve any relative file URL
 * against the repo root (two levels up from this file) so the
 * migrate command and the runtime always agree on the same DB,
 * regardless of which directory the user starts the backend from.
 */
const repoRoot = path.resolve(__dirname, '..', '..');

const resolveUrl = (raw: string): string => {
  if (!raw.startsWith('file:')) return raw;
  const filePath = raw.replace(/^file:/, '');
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(repoRoot, filePath);
};

const url = resolveUrl(process.env.DATABASE_URL ?? 'file:./prisma/dev.db');

const adapter = new PrismaBetterSqlite3({ url });

export const prisma = new PrismaClient({ adapter });

export type Prisma = typeof prisma;
