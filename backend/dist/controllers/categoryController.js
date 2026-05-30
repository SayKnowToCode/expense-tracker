"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getAllCategories = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const getAllCategories = async (req, res) => {
    const categories = await prisma.category.findMany();
    res.json(categories);
};
exports.getAllCategories = getAllCategories;
const createCategory = async (req, res) => {
    const data = req.body;
    const category = await prisma.category.create({ data });
    res.status(201).json(category);
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const category = await prisma.category.update({ where: { id: Number(id) }, data });
    res.json(category);
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    const { id } = req.params;
    await prisma.category.delete({ where: { id: Number(id) } });
    res.status(204).end();
};
exports.deleteCategory = deleteCategory;
