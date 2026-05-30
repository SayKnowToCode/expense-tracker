import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getAllTransactions = async (req: Request, res: Response) => {
  const transactions = await prisma.transaction.findMany({
    include: { category: true, merchant: true, tags: true, import: true },
    orderBy: { transactionDate: 'desc' },
  });
  res.json(transactions);
};

export const getTransactionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const transaction = await prisma.transaction.findUnique({
    where: { id: Number(id) },
    include: { category: true, merchant: true, tags: true, import: true },
  });
  if (!transaction) return res.status(404).json({ error: 'Not found' });
  res.json(transaction);
};

export const createTransaction = async (req: Request, res: Response) => {
  const data = req.body;
  const transaction = await prisma.transaction.create({ data });
  res.status(201).json(transaction);
};

export const updateTransaction = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const transaction = await prisma.transaction.update({
    where: { id: Number(id) },
    data,
  });
  res.json(transaction);
};

export const deleteTransaction = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.transaction.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
