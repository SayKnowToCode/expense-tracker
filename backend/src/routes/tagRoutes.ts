import { Router } from 'express';
import * as tagController from '../controllers/tagController';

const router = Router();

router.get('/', tagController.getAllTags);
router.post('/', tagController.createTag);
router.delete('/:id', tagController.deleteTag);

export default router;
