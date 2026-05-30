import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';


import { parseAndStoreTransactions } from '../services/importService';
const prisma = new PrismaClient();
export const importCsv = async (req: Request, res: Response) => {
  const { fileName, originalCsv, parsedRows, columnMapping } = req.body;
  // Store import record
  const imp = await prisma.import.create({
    data: {
      fileName,
      originalCsv,
      summary: '',
    },
  });
  // Parse and store transactions
  const { created, duplicates } = await parseAndStoreTransactions(parsedRows, imp.id);
  // Update summary
  await prisma.import.update({
    where: { id: imp.id },
    data: { summary: `Imported: ${created.length}, Duplicates: ${duplicates.length}` },
  });
  res.json({ importId: imp.id, createdCount: created.length, duplicateCount: duplicates.length });
};

export const getAllImports = async (req: Request, res: Response) => {
  const imports = await prisma.import.findMany({ include: { transactions: true } });
  res.json(imports);
};

export const getImportById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const imp = await prisma.import.findUnique({ where: { id: Number(id) }, include: { transactions: true } });
  if (!imp) return res.status(404).json({ error: 'Not found' });
  res.json(imp);
};

export const createImport = async (req: Request, res: Response) => {
  const data = req.body;
  const imp = await prisma.import.create({ data });
  res.status(201).json(imp);
};

export const deleteImport = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.import.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
