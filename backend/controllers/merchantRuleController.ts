import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getAllMerchantRules = async (req: Request, res: Response) => {
  const rules = await prisma.merchantRule.findMany({ include: { category: true, merchant: true } });
  res.json(rules);
};

export const createMerchantRule = async (req: Request, res: Response) => {
  const data = req.body;
  const rule = await prisma.merchantRule.create({ data });
  res.status(201).json(rule);
};

export const updateMerchantRule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const rule = await prisma.merchantRule.update({ where: { id: Number(id) }, data });
  res.json(rule);
};

export const deleteMerchantRule = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.merchantRule.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
