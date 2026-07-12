import multer  from 'multer';
import sharp   from 'sharp';

/* ── In-memory storage (no temp files on disk) ─────────── */
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG and WebP images are allowed'));
  },
});

/**
 * Auto-compress uploaded image buffer before sending to Cloudinary.
 * Output: WebP, max 1200×1200, quality 82 — typically 50–200 KB regardless of input.
 */
export async function compressImage(buffer) {
  return sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/* ── GST Filing Automation: 3 monthly source files (Amazon B2B/B2C CSV, Flipkart XLSX) ──
   Browser/OS MIME-type detection for .xlsx is unreliable (Windows sometimes reports it as a
   generic zip type since the format IS a zip container; some browsers send '' for extensions
   they don't recognize). Requiring BOTH extension and mimetype to match risked silently
   rejecting a genuinely valid file before it ever reached the parser, no error surfaced to the
   admin, indistinguishable from "the calculation just didn't use this file". Extension is the
   more reliable signal here, so either one matching is enough; only reject if NEITHER matches. */
export const uploadGstFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    const okExt = /\.(csv|xlsx|xls)$/i.test(file.originalname || '');
    const okMime = [
      'text/csv', 'application/vnd.ms-excel', 'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', 'application/zip', 'application/x-zip-compressed',
      'application/x-compressed', 'multipart/x-zip', '', // some browsers send blank
    ].includes(file.mimetype);
    if (okExt || okMime) return cb(null, true);
    const err = new Error(`"${file.originalname}" was rejected (mimetype "${file.mimetype}", expected .csv/.xlsx/.xls). If this is genuinely a CSV/XLSX file, tell the admin to report this exact mimetype.`);
    // This error is thrown from inside multer's own middleware, before the route handler's own
    // try/catch ever runs, so it goes straight to the app's shared error handler. That handler
    // masks messages behind a generic "Something went wrong" in production for status >= 500
    // (a deliberate, correct policy for most routes), but a rejected file is a 400-shaped problem
    // and this specific message is exactly what's needed to diagnose it, not a leak.
    err.status = 400;
    cb(err);
  },
});
