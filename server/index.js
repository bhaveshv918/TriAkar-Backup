import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payments.js';
import cartRoutes from './routes/cart.js';
import adminRoutes from './routes/admin.js';
import inquiryRoutes from './routes/inquiries.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5500' }));

app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inquiries', inquiryRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', brand: 'TriAkar' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TriAkar server running on port ${PORT}`);
});
