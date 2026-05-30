import express from 'express';
import cors from 'cors';
import transactionRoutes from './routes/transactionRoutes';
import categoryRoutes from './routes/categoryRoutes';
import merchantRoutes from './routes/merchantRoutes';
import importRoutes from './routes/importRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import tagRoutes from './routes/tagRoutes';
import merchantRuleRoutes from './routes/merchantRuleRoutes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/merchant-rules', merchantRuleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
