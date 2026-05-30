"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMerchantRule = exports.updateMerchantRule = exports.createMerchantRule = exports.getAllMerchantRules = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const getAllMerchantRules = async (req, res) => {
    const rules = await prisma.merchantRule.findMany({ include: { category: true, merchant: true } });
    res.json(rules);
};
exports.getAllMerchantRules = getAllMerchantRules;
const createMerchantRule = async (req, res) => {
    const data = req.body;
    const rule = await prisma.merchantRule.create({ data });
    res.status(201).json(rule);
};
exports.createMerchantRule = createMerchantRule;
const updateMerchantRule = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const rule = await prisma.merchantRule.update({ where: { id: Number(id) }, data });
    res.json(rule);
};
exports.updateMerchantRule = updateMerchantRule;
const deleteMerchantRule = async (req, res) => {
    const { id } = req.params;
    await prisma.merchantRule.delete({ where: { id: Number(id) } });
    res.status(204).end();
};
exports.deleteMerchantRule = deleteMerchantRule;
