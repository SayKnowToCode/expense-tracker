"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTag = exports.createTag = exports.getAllTags = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const getAllTags = async (req, res) => {
    const tags = await prisma.tag.findMany();
    res.json(tags);
};
exports.getAllTags = getAllTags;
const createTag = async (req, res) => {
    const data = req.body;
    const tag = await prisma.tag.create({ data });
    res.status(201).json(tag);
};
exports.createTag = createTag;
const deleteTag = async (req, res) => {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id: Number(id) } });
    res.status(204).end();
};
exports.deleteTag = deleteTag;
