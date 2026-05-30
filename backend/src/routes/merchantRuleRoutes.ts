import { Router } from 'express';
import * as merchantRuleController from '../controllers/merchantRuleController';

const router = Router();

router.get('/', merchantRuleController.getAllMerchantRules);
router.post('/', merchantRuleController.createMerchantRule);
router.put('/:id', merchantRuleController.updateMerchantRule);
router.delete('/:id', merchantRuleController.deleteMerchantRule);

export default router;
