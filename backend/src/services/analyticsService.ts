import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export const getDashboardSummary = async () => {
  const totalIncome = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { debitOrCredit: 'credit' },
  });
  const totalExpenses = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { debitOrCredit: 'debit' },
  });
  const netSavings = (totalIncome._sum.amount || 0) - (totalExpenses._sum.amount || 0);
  return {
    totalIncome: totalIncome._sum.amount || 0,
    totalExpenses: totalExpenses._sum.amount || 0,
    netSavings,
  };
};
