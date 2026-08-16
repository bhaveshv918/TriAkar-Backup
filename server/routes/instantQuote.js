import { Router } from 'express';
import crypto from 'crypto';
import supabase from '../db/supabaseClient.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import { uploadModel } from '../middleware/uploadMiddleware.js';
import { uploadRawBufferToCloudinary } from '../services/cloudinaryService.js';
import { analyzeMeshWithTimeout } from '../services/meshAnalysisService.js';
import { computeInstantQuotePrice } from '../services/instantQuotePricingService.js';

const router = Router();

/* ── Signed, stateless "draft quote" token ──────────────────
   /analyze computes geometry from the actual uploaded file and hands the
   customer a signed token carrying that geometry. /price only ever trusts
   geometry it reads back out of a verified token, never a value sent
   directly in the /price request body, so a customer can't submit a fake
   small volume_cm3 to buy a cheap price for a large uploaded model. */
const TOKEN_SECRET = process.env.INSTANT_QUOTE_TOKEN_SECRET || process.env.RAZORPAY_KEY_SECRET;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes to complete the wizard

function signQuoteToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
// Customer-facing reference for a priced quote, e.g. "IQ-20260816-4821".
// Same date+random-suffix shape as generateInvoiceNumber() in
// paymentController.js, but quote_number is DB-unique, so on the rare
// collision this just regenerates and retries the insert.
function generateQuoteNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `IQ-${date}-${rand}`;
}

function verifyQuoteToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) throw Object.assign(new Error('Invalid quote token'), { status: 400 });
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig), expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw Object.assign(new Error('Invalid quote token'), { status: 400 });
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (!payload.exp || payload.exp < Date.now()) {
    throw Object.assign(new Error('Quote token expired, please re-upload your model'), { status: 400 });
  }
  return payload;
}

/* ── GET /api/instant-quote/options, public catalog ──────── */
router.get('/options', async (_req, res, next) => {
  try {
    const [{ data: materials, error: mErr }, { data: printers, error: pErr }, { data: colors, error: cErr }] = await Promise.all([
      supabase.from('instant_quote_materials').select('id,name,filament_type,density_g_cm3,is_default,material_group,limited_colors')
        .eq('active', true).order('sort_order'),
      // build_x/y/z only, `name` deliberately excluded, customers shouldn't
      // see printer brand/model, just the build volume they're fitting into.
      supabase.from('instant_quote_printers').select('id,build_x_mm,build_y_mm,build_z_mm,is_default')
        .eq('active', true).order('sort_order'),
      supabase.from('instant_quote_colors').select('id,name,hex,is_default')
        .eq('active', true).order('sort_order'),
    ]);
    if (mErr) throw mErr;
    if (pErr) throw pErr;
    if (cErr) throw cErr;
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ materials: materials || [], printers: printers || [], colors: colors || [] });
  } catch (err) { next(err); }
});

/* ── POST /api/instant-quote/analyze, upload + mesh analysis ──
   No login required, a first-time visitor can upload and price a model
   straight away. optionalAuth attaches req.user when they're already
   logged in, but never blocks an anonymous upload. Login only becomes
   mandatory at actual checkout (createOrder / createWhatsAppOrder), where
   an unclaimed (user_id null) quote gets claimed by whoever is checking out. */
router.post('/analyze', optionalAuth, uploadModel.single('model'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No model file provided' });
    const unit = req.body.unit === 'inch' ? 'inch' : 'mm';
    const format = /\.obj$/i.test(req.file.originalname) ? 'obj' : 'stl';

    const stats = await analyzeMeshWithTimeout(req.file.buffer, format, unit);

    // Deliberately never reject an upload for being "too big to fit" any
    // catalog printer, oversized parts still get a quote (split/rescale/large-
    // format printing is a production-team judgment call, not something an
    // automated upload gate should block a customer over).

    // Raw (non-image) Cloudinary resources use the public_id's own extension for
    // delivery/content-type, a bare id with no extension produced a URL with no
    // .stl/.obj suffix, so browsers/OS couldn't tell what kind of file it was and
    // the download looked like a broken/temp file.
    const randomId = crypto.randomBytes(16).toString('hex') + '.' + format;
    const result = await uploadRawBufferToCloudinary(req.file.buffer, {
      folder: 'triakar/instant-quote-models',
      public_id: randomId,
    });

    const geometry = {
      model_file_url: result.secure_url,
      model_public_id: result.public_id,
      file_name: (req.file.originalname || 'model').slice(0, 200),
      file_format: format,
      volume_cm3: stats.volume_cm3,
      dims_mm: stats.dims_mm,
      surface_area_cm2: stats.surface_area_cm2,
      triangle_count: stats.triangle_count,
      user_id: req.user?.id || null,
      exp: Date.now() + TOKEN_TTL_MS,
    };

    res.json({ quote_token: signQuoteToken(geometry), ...geometry, user_id: undefined, exp: undefined });
  } catch (err) { next(err); }
});

/* ── POST /api/instant-quote/price, compute price + persist the quote ── */
const VALID_NOZZLES = [0.2, 0.4, 0.6, 0.8];
// Layer height is physically bounded by nozzle diameter, so the valid set
// depends on which nozzle was picked. Must match LAYER_HEIGHT_TIERS_BY_NOZZLE
// in instant-quote.html exactly (mm values only), or a legitimate frontend
// choice gets rejected here.
const VALID_LAYER_HEIGHTS_BY_NOZZLE = {
  0.2: [0.05, 0.08, 0.1, 0.14],
  0.4: [0.08, 0.12, 0.2, 0.28],
  0.6: [0.12, 0.2, 0.3, 0.4],
  0.8: [0.2, 0.3, 0.4, 0.6],
};

router.post('/price', optionalAuth, async (req, res, next) => {
  try {
    const { quote_token, printer_id, material_id, color_id, infill_percent, nozzle_mm, layer_height_mm, contact_name, contact_phone, custom_notes } = req.body;
    if (!quote_token) return res.status(400).json({ error: 'quote_token is required' });

    const geometry = verifyQuoteToken(quote_token);
    // geometry.user_id is only set if the visitor was already logged in at
    // upload time, an anonymous upload carries no user_id to check against.
    if (geometry.user_id && req.user && geometry.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This quote token does not belong to your account' });
    }

    const infill = Number(infill_percent);
    if (!Number.isFinite(infill) || infill < 5 || infill > 100) {
      return res.status(400).json({ error: 'infill_percent must be between 5 and 100' });
    }
    const nozzle = Number(nozzle_mm) || 0.4;
    if (!VALID_NOZZLES.includes(nozzle)) {
      return res.status(400).json({ error: 'nozzle_mm must be one of 0.2, 0.4, 0.6, 0.8' });
    }
    const layerHeight = Number(layer_height_mm) || 0.2;
    const validLayerHeights = VALID_LAYER_HEIGHTS_BY_NOZZLE[nozzle] || [];
    if (!validLayerHeights.includes(layerHeight)) {
      return res.status(400).json({ error: `layer_height_mm for a ${nozzle}mm nozzle must be one of ${validLayerHeights.join(', ')}` });
    }

    const [{ data: printer }, { data: material }, { data: color }] = await Promise.all([
      supabase.from('instant_quote_printers').select('*').eq('id', printer_id).eq('active', true).maybeSingle(),
      supabase.from('instant_quote_materials').select('*').eq('id', material_id).eq('active', true).maybeSingle(),
      color_id ? supabase.from('instant_quote_colors').select('*').eq('id', color_id).eq('active', true).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!printer) return res.status(400).json({ error: 'Selected printer is not available' });
    if (!material) return res.status(400).json({ error: 'Selected material is not available' });
    if (color_id && !color) return res.status(400).json({ error: 'Selected color is not available' });
    // Some materials (ABS/ASA) are only stocked in a limited color range, enforce
    // it server-side too, not just as a frontend filter, in case of a stale UI state.
    if (color && material.limited_colors && material.limited_colors.length && !material.limited_colors.includes(color.name)) {
      return res.status(400).json({ error: `${material.name} is only available in: ${material.limited_colors.join(', ')}` });
    }

    // Deliberately never blocked for not fitting the selected printer's build
    // volume, same reasoning as /analyze, an oversized model still gets priced
    // and ordered; production handles sizing/splitting as a human judgment call.

    const priced = await computeInstantQuotePrice({ volume_cm3: geometry.volume_cm3, infill_percent: infill, material, nozzle_mm: nozzle, layer_height_mm: layerHeight, surface_area_cm2: geometry.surface_area_cm2 });

    const row = {
      user_id: req.user?.id || null,
      model_file_url: geometry.model_file_url,
      model_public_id: geometry.model_public_id,
      file_name: geometry.file_name,
      file_format: geometry.file_format,
      volume_cm3: geometry.volume_cm3,
      dims_mm: geometry.dims_mm,
      surface_area_cm2: geometry.surface_area_cm2,
      triangle_count: geometry.triangle_count,
      printer_id: printer.id,
      material_id: material.id,
      color_id: color ? color.id : null,
      nozzle_mm: nozzle,
      infill_percent: infill,
      estimated_print_time_hours: priced.print_time_hours,
      estimated_weight_g: priced.weight_g,
      price_breakdown: priced.price_breakdown,
      final_price: priced.final_price,
      status: 'quoted',
      // Lead capture, optional, customer can skip. Trimmed + length-capped
      // since these land straight in the admin panel with no other validation.
      contact_name:  contact_name  ? String(contact_name).trim().slice(0, 120)  : null,
      contact_phone: contact_phone ? String(contact_phone).trim().slice(0, 20)  : null,
      custom_notes:  custom_notes  ? String(custom_notes).trim().slice(0, 500)  : null,
      layer_height_mm: layerHeight,
    };

    // quote_number is DB-unique but collision-checked here too, on the rare
    // clash (same-second date+random match) this just tries a fresh number
    // rather than failing the whole quote over a display-only field.
    let quote, error;
    for (let attempt = 0; attempt < 3; attempt++) {
      ({ data: quote, error } = await supabase.from('instant_quote_requests')
        .insert({ ...row, quote_number: generateQuoteNumber() }).select().single());
      if (!error || error.code !== '23505') break;
    }
    if (error) throw error;

    res.json({ quote });
  } catch (err) { next(err); }
});

/* ── GET /api/instant-quote/:quote_id, refetch (cart/checkout re-verification) ── */
router.get('/:quote_id', requireAuth, async (req, res, next) => {
  try {
    const { data: quote, error } = await supabase
      .from('instant_quote_requests').select('*')
      .eq('id', req.params.quote_id).eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json({ quote });
  } catch (err) { next(err); }
});

export default router;
