import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getAllCategories = async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
};

export const createCategory = async (req: Request, res: Response) => {
  const data = req.body;
  const category = await prisma.category.create({ data });
  res.status(201).json(category);
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const category = await prisma.category.update({ where: { id: Number(id) }, data });
  res.json(category);
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.category.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
