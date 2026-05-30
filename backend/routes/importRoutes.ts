import { Router } from 'express';
import * as importController from '../controllers/importController';

const router = Router();


router.get('/', importController.getAllImports);
router.get('/:id', importController.getImportById);
router.post('/', importController.createImport);
router.post('/csv', importController.importCsv);
router.delete('/:id', importController.deleteImport);

export default router;
