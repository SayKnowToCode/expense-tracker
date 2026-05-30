"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTransaction = exports.updateTransaction = exports.createTransaction = exports.getTransactionById = exports.getAllTransactions = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const getAllTransactions = async (req, res) => {
    const transactions = await prisma.transaction.findMany({
        include: { category: true, merchant: true, tags: true, import: true },
        orderBy: { transactionDate: 'desc' },
    });
    res.json(transactions);
};
exports.getAllTransactions = getAllTransactions;
const getTransactionById = async (req, res) => {
    const { id } = req.params;
    const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
        include: { category: true, merchant: true, tags: true, import: true },
    });
    if (!transaction)
        return res.status(404).json({ error: 'Not found' });
    res.json(transaction);
};
exports.getTransactionById = getTransactionById;
const createTransaction = async (req, res) => {
    const data = req.body;
    const transaction = await prisma.transaction.create({ data });
    res.status(201).json(transaction);
};
exports.createTransaction = createTransaction;
const updateTransaction = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const transaction = await prisma.transaction.update({
        where: { id: Number(id) },
        data,
    });
    res.json(transaction);
};
exports.updateTransaction = updateTransaction;
const deleteTransaction = async (req, res) => {
    const { id } = req.params;
    await prisma.transaction.delete({ where: { id: Number(id) } });
    res.status(204).end();
};
exports.deleteTransaction = deleteTransaction;
