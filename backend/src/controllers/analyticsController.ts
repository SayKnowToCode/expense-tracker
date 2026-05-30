import { Request, Response } from 'express';
import { getDashboardSummary as getSummary } from '../services/analyticsService';

export const getDashboardSummary = async (req: Request, res: Response) => {
  const summary = await getSummary();
  res.json(summary);
};
