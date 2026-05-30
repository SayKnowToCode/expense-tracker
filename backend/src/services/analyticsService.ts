import { prisma } from '../db';

/**
 * Headline numbers for the dashboard.
 *
 * `avgDailySpend` is computed over the calendar range the data
 * actually covers (first txn date → last txn date), so a single big
 * payment doesn't make it look like the user spends ₹40k per day.
 */
export const getDashboardSummary = async () => {
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { debitOrCredit: 'credit' },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { debitOrCredit: 'debit' },
    }),
  ]);

  const totalIncome = income._sum.amount || 0;
  const totalExpenses = expenses._sum.amount || 0;
  const netSavings = totalIncome - totalExpenses;

  const range = await prisma.transaction.aggregate({
    _min: { transactionDate: true },
    _max: { transactionDate: true },
    _count: { _all: true },
  });

  let avgDailySpend = 0;
  let days = 0;
  if (range._min.transactionDate && range._max.transactionDate) {
    const ms =
      range._max.transactionDate.getTime() - range._min.transactionDate.getTime();
    days = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
    avgDailySpend = totalExpenses / days;
  }

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    transactionCount: range._count._all,
    daysCovered: days,
    avgDailySpend,
    firstTransactionDate: range._min.transactionDate,
    lastTransactionDate: range._max.transactionDate,
  };
};

interface SpendBucket {
  key: string;
  label: string;
  totalAmount: number;
  transactionCount: number;
}

/**
 * Total debit spend grouped by tag. Uses raw SQL because Prisma's
 * `groupBy` doesn't understand many-to-many relations and we'd
 * otherwise have to round-trip every tag separately.
 */
export const getSpendByTag = async (): Promise<SpendBucket[]> => {
  const rows = await prisma.$queryRawUnsafe<
    { id: number; name: string; total: number; count: number }[]
  >(`
    SELECT t.id as id, t.name as name,
           COALESCE(SUM(tx.amount), 0) as total,
           COUNT(*) as count
    FROM "Tag" t
    JOIN "_TransactionTags" tt ON tt."A" = t.id
    JOIN "Transaction" tx ON tx.id = tt."B"
    WHERE tx."debitOrCredit" = 'debit'
    GROUP BY t.id, t.name
    ORDER BY total DESC
  `);
  return rows.map((r) => ({
    key: String(r.id),
    label: r.name,
    totalAmount: Number(r.total),
    transactionCount: Number(r.count),
  }));
};

export const getSpendByCategory = async (): Promise<SpendBucket[]> => {
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { debitOrCredit: 'debit' },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const cats = await prisma.category.findMany();
  const byId = new Map<number, string>(
    cats.map((c: { id: number; name: string }) => [c.id, c.name]),
  );
  return grouped
    .map((g: { categoryId: number | null; _sum: { amount: number | null }; _count: { _all: number } }) => ({
      key: g.categoryId == null ? 'uncategorized' : String(g.categoryId),
      label: g.categoryId == null ? '(uncategorized)' : byId.get(g.categoryId) || `#${g.categoryId}`,
      totalAmount: g._sum.amount || 0,
      transactionCount: g._count._all,
    }))
    .sort((a: SpendBucket, b: SpendBucket) => b.totalAmount - a.totalAmount);
};

export const getSpendByMerchant = async (limit = 25): Promise<SpendBucket[]> => {
  const grouped = await prisma.transaction.groupBy({
    by: ['merchantKey'],
    where: { debitOrCredit: 'debit' },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });
  return grouped.map((g: { merchantKey: string; _sum: { amount: number | null }; _count: { _all: number } }) => ({
    key: g.merchantKey || 'UNKNOWN',
    label: g.merchantKey || 'UNKNOWN',
    totalAmount: g._sum.amount || 0,
    transactionCount: g._count._all,
  }));
};

export interface DailyPoint {
  date: string;
  spend: number;
  income: number;
  count: number;
}

export const getDailySeries = async (): Promise<DailyPoint[]> => {
  const rows = await prisma.$queryRawUnsafe<
    { day: string; spend: number; income: number; count: number }[]
  >(`
    SELECT date(transactionDate) as day,
           COALESCE(SUM(CASE WHEN debitOrCredit = 'debit'  THEN amount ELSE 0 END), 0) as spend,
           COALESCE(SUM(CASE WHEN debitOrCredit = 'credit' THEN amount ELSE 0 END), 0) as income,
           COUNT(*) as count
    FROM "Transaction"
    GROUP BY day
    ORDER BY day
  `);
  return rows.map((r) => ({
    date: r.day,
    spend: Number(r.spend),
    income: Number(r.income),
    count: Number(r.count),
  }));
};
