import { Router } from 'express';
import * as transactionController from '../controllers/transactionController';

const router = Router();

router.get('/', transactionController.getAllTransactions);
router.get('/:id', transactionController.getTransactionById);
router.post('/', transactionController.createTransaction);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);
router.put('/:id/tags', transactionController.setTransactionTags);
router.put('/:id/category', transactionController.setTransactionCategory);

export default router;
