import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export const getAllMerchants = async (req: Request, res: Response) => {
  const merchants = await prisma.merchant.findMany();
  res.json(merchants);
};

export const createMerchant = async (req: Request, res: Response) => {
  const data = req.body;
  const merchant = await prisma.merchant.create({ data });
  res.status(201).json(merchant);
};

export const updateMerchant = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const merchant = await prisma.merchant.update({ where: { id: Number(id) }, data });
  res.json(merchant);
};

export const deleteMerchant = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.merchant.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
