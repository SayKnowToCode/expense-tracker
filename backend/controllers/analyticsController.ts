import { Request, Response } from 'express';
import { getDashboardSummary } from '../services/analyticsService';

export const getDashboardSummary = async (req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  res.json(summary);
};
