import { Router } from 'express';
import * as ctrl from '../controllers/autoRulesController';

const router = Router();

router.get('/tags', ctrl.listAutoTagRules);
router.delete('/tags/:id', ctrl.deleteAutoTagRule);
router.get('/categories', ctrl.listAutoCategoryRules);
router.delete('/categories/:id', ctrl.deleteAutoCategoryRule);
router.post('/backfill-merchant-keys', ctrl.backfillMerchantKeys);

export default router;
