import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getAllTags = async (req: Request, res: Response) => {
  const tags = await prisma.tag.findMany();
  res.json(tags);
};

export const createTag = async (req: Request, res: Response) => {
  const data = req.body;
  const tag = await prisma.tag.create({ data });
  res.status(201).json(tag);
};

export const deleteTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.tag.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
