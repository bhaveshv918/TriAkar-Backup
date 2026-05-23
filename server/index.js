import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp     from 'hpp';
import timeout from 'connect-timeout';
import xss     from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

import productRoutes  from './routes/products.js';
import orderRoutes    from './routes/orders.js';
import authRoutes     from './routes/auth.js';
import paymentRoutes  from './routes/payments.js';
import cartRoutes     from './routes/cart.js';
import adminRoutes    from './routes/admin.js';
import inquiryRoutes  from './routes/inquiries.js';
import addressRoutes  from './routes/addresses.js';
import notifyRoutes      from './routes/notify.js';
import categoryRoutes    from './routes/categories.js';
import pincodeRoutes     from './routes/pincode.js';
import promoRoutes       from './routes/promo.js';
import reviewRoutes      from './routes/reviews.js';
import { errorHandler } from './middleware/errorHandler.js';

/* ── ENV VALIDATION (fail fast on missing secrets) ────────── */
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'FRONTEND_URL',
];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}
console.log('All environment variables verified.');
// Optional (not required to boot): NODE_ENV, PORT, RENDER_EXTERNAL_URL,
// RESEND_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

const app  = express();
const PORT = process.env.PORT || 3000;

/* Render/Vercel sit behind a proxy — needed for correct client IPs (rate limiting) */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ── 1. REQUEST TIMEOUT ───────────────────────────────────── */
app.use(timeout('30s'));
function haltOnTimedout(req, _res, next) { if (!req.timedout) next(); }
// FIX #9: halt immediately after timeout — before any body parsing or processing
app.use(haltOnTimedout);

/* ── 2. HELMET (security headers + CSP) ───────────────────── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://checkout.razorpay.com',
        'https://cdn.razorpay.com',
        'https://www.googletagmanager.com',  // FIX #23: GA4
        'https://www.google-analytics.com',
        'https://cdn.jsdelivr.net',
        "'unsafe-inline'",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        'https://triakar.onrender.com',
        'https://*.supabase.co',
        'https://api.razorpay.com',
        'https://api.postalpincode.in',
        'https://nominatim.openstreetmap.org',  // address autocomplete
        'https://www.google-analytics.com',
        'https://analytics.google.com',
        'https://region1.analytics.google.com',
      ],
      frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/* Extra hardening headers on every response */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

/* ── 3. CORS (strict allow-list) ──────────────────────────── */
const allowedOrigins = [
  'https://triakar.com',
  'https://www.triakar.com',
  'https://triakar.in',
  'https://www.triakar.in',
  'https://triakar.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);            // health-checks, curl, server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS: ' + origin), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

/* ── 4. RATE LIMITING ─────────────────────────────────────── */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many payment attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/payments', paymentLimiter);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/inquiries', contactLimiter);
app.use('/api/addresses', contactLimiter);

const notifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/notify', notifyLimiter);

/* ── 5. BODY PARSING (size-limited) ───────────────────────── */
// Image upload routes allow up to 15 MB (multipart handled by multer, not express.json)
// All other JSON routes stay at 10 kb for security
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* ── 6-8. INPUT SANITIZATION ──────────────────────────────── */
app.use(xss());
app.use(mongoSanitize());
app.use(hpp());
// haltOnTimedout already registered at line 50 (right after timeout())

/* ── 9. ROUTES ────────────────────────────────────────────── */
app.use('/api/products',   productRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/cart',       cartRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/inquiries',  inquiryRoutes);
app.use('/api/addresses',  addressRoutes);
app.use('/api/notify',     notifyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/pincode',    pincodeRoutes);   // India Post proxy — bypasses expired cert
app.use('/api/promo',      promoRoutes);     // Promo code validate + admin CRUD
app.use('/api/reviews',    reviewRoutes);    // Product reviews — public + admin CRUD

/* /api/profile — see server/routes/auth.js handlers; also accessible at /api/auth/profile */

app.get('/health', (_req, res) => res.json({ status: 'ok', brand: 'TriAkar' }));

/* ── 10. 404 HANDLER ──────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ── 11. ERROR HANDLER (must be last) ─────────────────────── */
app.use(errorHandler);

app.listen(PORT, () => console.log(`TriAkar server running on port ${PORT}`));

/* ── KEEPALIVE — prevents Render free tier from sleeping ──── */
// Optional env var: RENDER_EXTERNAL_URL (Render sets this automatically;
// falls back to the known production URL). Not required for boot.
if (process.env.NODE_ENV === 'production') {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://triakar.onrender.com';

  setInterval(() => {
    fetch(RENDER_URL + '/health')
      .then(() => console.log('Keepalive ping sent'))
      .catch(err => console.log('Keepalive failed:', err.message));
  }, 14 * 60 * 1000); // ping every 14 minutes (before the 15-min sleep)

  console.log('Keepalive scheduler started');
}
