"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImport = exports.importCsv = exports.createImport = exports.getImportById = exports.getAllImports = void 0;
const prisma_1 = require("../../generated/prisma");
const importService_1 = require("../services/importService");
const prisma = new prisma_1.PrismaClient();
const getAllImports = async (req, res) => {
    const imports = await prisma.import.findMany({ include: { transactions: true } });
    res.json(imports);
};
exports.getAllImports = getAllImports;
const getImportById = async (req, res) => {
    const { id } = req.params;
    const imp = await prisma.import.findUnique({ where: { id: Number(id) }, include: { transactions: true } });
    if (!imp)
        return res.status(404).json({ error: 'Not found' });
    res.json(imp);
};
exports.getImportById = getImportById;
const createImport = async (req, res) => {
    const data = req.body;
    const imp = await prisma.import.create({ data });
    res.status(201).json(imp);
};
exports.createImport = createImport;
const importCsv = async (req, res) => {
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
    const { created, duplicates } = await (0, importService_1.parseAndStoreTransactions)(parsedRows, imp.id);
    // Update summary
    await prisma.import.update({
        where: { id: imp.id },
        data: { summary: `Imported: ${created.length}, Duplicates: ${duplicates.length}` },
    });
    res.json({ importId: imp.id, createdCount: created.length, duplicateCount: duplicates.length });
};
exports.importCsv = importCsv;
const deleteImport = async (req, res) => {
    const { id } = req.params;
    await prisma.import.delete({ where: { id: Number(id) } });
    res.status(204).end();
};
exports.deleteImport = deleteImport;
