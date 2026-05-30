"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchMerchantRule = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const matchMerchantRule = async (description) => {
    // Try exact, contains, regex in order
    const rules = await prisma.merchantRule.findMany({
        include: { category: true, merchant: true },
    });
    for (const rule of rules) {
        if (rule.matchType === 'exact' && description === rule.pattern) {
            return { categoryId: rule.categoryId, merchantId: rule.merchantId || undefined };
        }
        if (rule.matchType === 'contains' && description.includes(rule.pattern)) {
            return { categoryId: rule.categoryId, merchantId: rule.merchantId || undefined };
        }
        if (rule.matchType === 'regex') {
            try {
                const regex = new RegExp(rule.pattern, 'i');
                if (regex.test(description)) {
                    return { categoryId: rule.categoryId, merchantId: rule.merchantId || undefined };
                }
            }
            catch { }
        }
    }
    return {};
};
exports.matchMerchantRule = matchMerchantRule;
