import { prisma } from '../db';

export const matchMerchantRule = async (description: string): Promise<{ categoryId?: number; merchantId?: number }> => {
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
      } catch {}
    }
  }
  return {};
};
