import { prisma } from '../db';

/**
 * Centralized rule engine for AutoTagRule / AutoCategoryRule.
 *
 * Why it exists: the user's mental model is "I tag NAMASTE HSR once
 * and from then on every NAMASTE HSR row is tagged forever — past,
 * present, and future". This file implements that contract.
 *
 * The rules table is the source of truth. Two write paths use it:
 *   1. `createAutoTagRule` / `createAutoCategoryRule`: persist the rule
 *      and immediately backfill all existing transactions with the
 *      matching merchantKey so the user sees the result without
 *      waiting for the next import.
 *   2. `applyRulesToTransaction`: called from the CSV importer for
 *      each newly inserted row so that future statements pick up the
 *      same tag/category without the user lifting a finger.
 */

export interface ApplyResult {
  attachedTagIds: number[];
  assignedCategoryId: number | null;
}

/**
 * Apply every matching rule to a single transaction. Used at import
 * time. Cheap: one indexed lookup per rule table per insert.
 */
export const applyRulesToTransaction = async (
  transactionId: number,
  merchantKey: string,
): Promise<ApplyResult> => {
  const attachedTagIds: number[] = [];
  let assignedCategoryId: number | null = null;

  if (!merchantKey) {
    return { attachedTagIds, assignedCategoryId };
  }

  const tagRules = await prisma.autoTagRule.findMany({
    where: { merchantKey },
    select: { tagId: true },
  });
  if (tagRules.length > 0) {
    const tagIds = tagRules.map((r: { tagId: number }) => r.tagId);
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { tags: { connect: tagIds.map((id: number) => ({ id })) } },
    });
    attachedTagIds.push(...tagIds);
  }

  const catRule = await prisma.autoCategoryRule.findUnique({
    where: { merchantKey },
    select: { categoryId: true },
  });
  if (catRule) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId: catRule.categoryId },
    });
    assignedCategoryId = catRule.categoryId;
  }

  return { attachedTagIds, assignedCategoryId };
};

/**
 * Create a tag rule and backfill it across every existing transaction
 * whose merchantKey matches. Idempotent: re-running with the same
 * (merchantKey, tagId) is a no-op.
 *
 * Returns the number of transactions that received the tag as a
 * result of this call (i.e. excluding those that already had it).
 */
export const createAutoTagRule = async (
  merchantKey: string,
  tagId: number,
): Promise<{ rule: { id: number }; backfilled: number }> => {
  if (!merchantKey) throw new Error('merchantKey is required');

  const rule = await prisma.autoTagRule.upsert({
    where: { merchantKey_tagId: { merchantKey, tagId } },
    create: { merchantKey, tagId },
    update: {},
    select: { id: true },
  });

  // Find every transaction with this merchantKey that doesn't already
  // have this tag attached, and connect the tag in one shot.
  const matches = await prisma.transaction.findMany({
    where: {
      merchantKey,
      NOT: { tags: { some: { id: tagId } } },
    },
    select: { id: true },
  });
  if (matches.length > 0) {
    await prisma.tag.update({
      where: { id: tagId },
      data: {
        transactions: {
          connect: matches.map((t: { id: number }) => ({ id: t.id })),
        },
      },
    });
  }

  return { rule, backfilled: matches.length };
};

/**
 * Create or replace the (single) category rule for this merchantKey
 * and backfill. If a different category was previously mapped, the
 * rule is updated and ALL matching transactions are re-categorized,
 * because the user is saying "from now on, this merchant is in that
 * category, period".
 */
export const createAutoCategoryRule = async (
  merchantKey: string,
  categoryId: number,
): Promise<{ rule: { id: number }; backfilled: number }> => {
  if (!merchantKey) throw new Error('merchantKey is required');

  const rule = await prisma.autoCategoryRule.upsert({
    where: { merchantKey },
    create: { merchantKey, categoryId },
    update: { categoryId },
    select: { id: true },
  });

  // We can't use `NOT: { categoryId }` here because in SQL three-valued
  // logic `categoryId != X` is NULL when the row's categoryId is NULL,
  // so unassigned rows would be excluded from the backfill — which is
  // the opposite of what we want.
  const result = await prisma.transaction.updateMany({
    where: {
      merchantKey,
      OR: [{ categoryId: null }, { categoryId: { not: categoryId } }],
    },
    data: { categoryId },
  });

  return { rule, backfilled: result.count };
};
