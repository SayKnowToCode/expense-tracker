import { Request, Response } from 'express';
import {
  getDailySeries,
  getDashboardSummary as getSummary,
  getSpendByCategory,
  getSpendByMerchant,
  getSpendByTag,
} from '../services/analyticsService';

export const getDashboardSummary = async (_req: Request, res: Response) => {
  res.json(await getSummary());
};

export const getByTag = async (_req: Request, res: Response) => {
  res.json(await getSpendByTag());
};

export const getByCategory = async (_req: Request, res: Response) => {
  res.json(await getSpendByCategory());
};

export const getByMerchant = async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
  res.json(await getSpendByMerchant(limit));
};

export const getDaily = async (_req: Request, res: Response) => {
  res.json(await getDailySeries());
};
