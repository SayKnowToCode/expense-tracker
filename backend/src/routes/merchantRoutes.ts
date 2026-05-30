import { Router } from 'express';
import * as merchantController from '../controllers/merchantController';

const router = Router();

router.get('/', merchantController.getAllMerchants);
router.post('/', merchantController.createMerchant);
router.put('/:id', merchantController.updateMerchant);
router.delete('/:id', merchantController.deleteMerchant);

export default router;
