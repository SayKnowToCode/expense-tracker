"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMerchant = exports.updateMerchant = exports.createMerchant = exports.getAllMerchants = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const getAllMerchants = async (req, res) => {
    const merchants = await prisma.merchant.findMany();
    res.json(merchants);
};
exports.getAllMerchants = getAllMerchants;
const createMerchant = async (req, res) => {
    const data = req.body;
    const merchant = await prisma.merchant.create({ data });
    res.status(201).json(merchant);
};
exports.createMerchant = createMerchant;
const updateMerchant = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const merchant = await prisma.merchant.update({ where: { id: Number(id) }, data });
    res.json(merchant);
};
exports.updateMerchant = updateMerchant;
const deleteMerchant = async (req, res) => {
    const { id } = req.params;
    await prisma.merchant.delete({ where: { id: Number(id) } });
    res.status(204).end();
};
exports.deleteMerchant = deleteMerchant;
