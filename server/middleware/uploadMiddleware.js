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
