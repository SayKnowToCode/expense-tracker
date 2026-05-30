import { Request, Response } from 'express';
import { prisma } from '../db';
import { extractMerchantKey } from '../utils/merchantKey';

export const listAutoTagRules = async (_req: Request, res: Response) => {
  const rules = await prisma.autoTagRule.findMany({
    include: { tag: true },
    orderBy: { merchantKey: 'asc' },
  });
  res.json(rules);
};

export const deleteAutoTagRule = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.autoTagRule.delete({ where: { id } });
  res.status(204).end();
};

export const listAutoCategoryRules = async (_req: Request, res: Response) => {
  const rules = await prisma.autoCategoryRule.findMany({
    include: { category: true },
    orderBy: { merchantKey: 'asc' },
  });
  res.json(rules);
};

export const deleteAutoCategoryRule = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.autoCategoryRule.delete({ where: { id } });
  res.status(204).end();
};

/**
 * Recompute `merchantKey` for every transaction that has an empty
 * value. Safe to call repeatedly. Useful for users who imported data
 * before the auto-rules feature shipped.
 */
export const backfillMerchantKeys = async (_req: Request, res: Response) => {
  const empties = await prisma.transaction.findMany({
    where: { merchantKey: '' },
    select: { id: true, description: true },
  });
  let updated = 0;
  for (const t of empties) {
    const key = extractMerchantKey(t.description);
    if (!key) continue;
    await prisma.transaction.update({
      where: { id: t.id },
      data: { merchantKey: key },
    });
    updated++;
  }
  res.json({ scanned: empties.length, updated });
};
