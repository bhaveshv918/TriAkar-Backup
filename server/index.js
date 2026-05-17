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
import addressRoutes from './routes/addresses.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://triakar.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Render health checks, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/addresses', addressRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', brand: 'TriAkar' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TriAkar server running on port ${PORT}`);
});
