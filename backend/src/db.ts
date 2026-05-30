import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';

/**
 * Single shared Prisma client for the whole backend.
 *
 * Prisma 7 requires the constructor to be given a driver adapter; using
 * one client per file (as the original code did) breaks compilation and
 * also opens nine independent connection pools against the same SQLite
 * file. Importing this singleton instead avoids both problems.
 */
const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';

const adapter = new PrismaBetterSqlite3({
  url: url.replace(/^file:/, ''),
});

export const prisma = new PrismaClient({ adapter });

export type Prisma = typeof prisma;
