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

/* ── GST Filing Automation: 3 monthly source files (Amazon B2B/B2C CSV, Flipkart XLSX) ── */
export const uploadGstFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    const okExt = /\.(csv|xlsx|xls)$/i.test(file.originalname || '');
    const okMime = [
      'text/csv', 'application/vnd.ms-excel', 'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', // some browsers send this for CSV/XLSX
    ].includes(file.mimetype);
    if (okExt && okMime) return cb(null, true);
    cb(new Error('Only CSV and XLSX files are allowed'));
  },
});
