import { Request, Response } from 'express';
import { prisma } from '../db';

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

/**
 * PUT /api/transactions/:id/tags
 * Body: { tags: string[] }
 *
 * Replaces the transaction's tag set with exactly the names provided.
 * Tag names are case-insensitive and auto-created on first use; any
 * existing tags not in the new list are detached (but not deleted, so
 * they remain available for other transactions).
 */
export const setTransactionTags = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const raw = req.body?.tags;
  if (!Array.isArray(raw)) {
    return res.status(400).json({ error: 'Body must be { tags: string[] }' });
  }

  const names = Array.from(
    new Set(
      raw
        .map((t) => String(t || '').trim())
        .filter((t) => t.length > 0)
        .map((t) => t.toLowerCase()),
    ),
  );

  try {
    const existing = await prisma.tag.findMany({
      where: { name: { in: names } },
    });
    const have = new Set(existing.map((t: { name: string }) => t.name));
    const toCreate = names.filter((n) => !have.has(n));
    if (toCreate.length > 0) {
      await prisma.tag.createMany({
        data: toCreate.map((name) => ({ name })),
      });
    }
    const all = await prisma.tag.findMany({ where: { name: { in: names } } });

    const updated = await prisma.transaction.update({
      where: { id },
      data: { tags: { set: all.map((t: { id: number }) => ({ id: t.id })) } },
      include: { tags: true, category: true, merchant: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    console.error('[setTransactionTags]', err);
    return res.status(500).json({ error: 'Failed to update tags' });
  }
};

/**
 * PUT /api/transactions/:id/category
 * Body: { categoryId: number | null }
 *
 * Validates the category exists before assigning. Pass `null` to clear.
 */
export const setTransactionCategory = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { categoryId } = req.body ?? {};
  if (categoryId !== null && (typeof categoryId !== 'number' || !Number.isInteger(categoryId))) {
    return res.status(400).json({ error: 'categoryId must be an integer or null' });
  }
  try {
    if (categoryId !== null) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat) return res.status(400).json({ error: `Category ${categoryId} not found` });
    }
    const updated = await prisma.transaction.update({
      where: { id },
      data: { categoryId },
      include: { tags: true, category: true, merchant: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    console.error('[setTransactionCategory]', err);
    return res.status(500).json({ error: 'Failed to update category' });
  }
};
