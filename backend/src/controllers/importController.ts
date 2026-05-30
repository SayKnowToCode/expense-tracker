import { Request, Response } from 'express';
import { prisma } from '../db';
import { parseAndStoreTransactions } from '../services/importService';

export const getAllImports = async (req: Request, res: Response) => {
  const imports = await prisma.import.findMany({ include: { transactions: true } });
  res.json(imports);
};

export const getImportById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const imp = await prisma.import.findUnique({
    where: { id: Number(id) },
    include: { transactions: true },
  });
  if (!imp) return res.status(404).json({ error: 'Not found' });
  res.json(imp);
};

export const createImport = async (req: Request, res: Response) => {
  const data = req.body;
  const imp = await prisma.import.create({ data });
  res.status(201).json(imp);
};

export const importCsv = async (req: Request, res: Response) => {
  const { fileName, originalCsv, parsedRows } = req.body ?? {};

  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ error: 'fileName is required' });
  }
  if (!Array.isArray(parsedRows)) {
    return res.status(400).json({ error: 'parsedRows must be an array' });
  }

  let imp;
  try {
    imp = await prisma.import.create({
      data: {
        fileName,
        originalCsv: originalCsv ?? '',
        summary: '',
      },
    });
  } catch (err) {
    console.error('[importCsv] failed to create import record', err);
    return res.status(500).json({ error: 'Failed to create import record' });
  }

  try {
    const { created, duplicates } = await parseAndStoreTransactions(parsedRows, imp.id);
    const summary = `Imported: ${created.length}, Duplicates: ${duplicates.length}, Total rows: ${parsedRows.length}`;
    await prisma.import.update({ where: { id: imp.id }, data: { summary } });
    return res.json({
      importId: imp.id,
      createdCount: created.length,
      duplicateCount: duplicates.length,
      totalRows: parsedRows.length,
      summary,
    });
  } catch (err) {
    console.error('[importCsv] failed to ingest rows', err);
    // The import record exists but nothing valuable lives under it. Remove
    // it so the user's import list isn't polluted with empty imports
    // after a failed upload.
    try {
      await prisma.import.delete({ where: { id: imp.id } });
    } catch {}
    return res.status(500).json({ error: 'Failed to ingest transactions' });
  }
};

export const deleteImport = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.import.delete({ where: { id: Number(id) } });
  res.status(204).end();
};
