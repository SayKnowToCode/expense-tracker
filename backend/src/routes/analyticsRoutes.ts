import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

router.get('/summary', analyticsController.getDashboardSummary);

export default router;
