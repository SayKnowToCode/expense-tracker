import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

router.get('/summary', analyticsController.getDashboardSummary);
router.get('/by-tag', analyticsController.getByTag);
router.get('/by-category', analyticsController.getByCategory);
router.get('/by-merchant', analyticsController.getByMerchant);
router.get('/daily', analyticsController.getDaily);

export default router;
