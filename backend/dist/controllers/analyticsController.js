"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = void 0;
const analyticsService_1 = require("../services/analyticsService");
const getDashboardSummary = async (req, res) => {
    const summary = await (0, analyticsService_1.getDashboardSummary)();
    res.json(summary);
};
exports.getDashboardSummary = getDashboardSummary;
