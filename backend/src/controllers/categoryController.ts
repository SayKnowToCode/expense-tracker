import { Request, Response } from 'express';
import { prisma } from '../db';

export const getAllCategories = async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json(categories);
};

/**
 * Create-or-return semantics. The frontend uses a free-form "or
 * create new" input and shouldn't have to disambiguate between "new"
 * and "already exists"; returning the existing record on a name
 * collision is the friendliest behavior and also prevents the
 * process from crashing on the unhandled P2002 violation.
 */
export const createCategory = async (req: Request, res: Response) => {
  const { name, description } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const category = await prisma.category.upsert({
      where: { name },
      create: { name, description: description ?? null },
      update: {},
    });
    return res.status(201).json(category);
  } catch (err) {
    console.error('[createCategory]', err);
    return res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: req.body,
    });
    res.json(category);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Name already taken' });
    console.error('[updateCategory]', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.category.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    console.error('[deleteCategory]', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
