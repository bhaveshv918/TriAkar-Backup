import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Build an optimised delivery URL for a product image.
 * Auto quality + auto format keeps renders crisp while staying lightweight.
 */
export function getProductImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    quality:      'auto',
    fetch_format: 'auto',
    width:        options.width  || 600,
    height:       options.height || 600,
    crop:         options.crop   || 'fill',
    gravity:      'center',
    ...options,
  });
}

/** Square 300x300 thumbnail for listings and cart rows. */
export function getThumbnailUrl(publicId) {
  return cloudinary.url(publicId, {
    quality:      'auto',
    fetch_format: 'auto',
    width:        300,
    height:       300,
    crop:         'fill',
    gravity:      'center',
  });
}

/**
 * Upload a Buffer directly to Cloudinary (for multer memoryStorage).
 * Returns the full Cloudinary upload result (secure_url, public_id, etc.).
 */
export function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:       options.folder       || 'triakar/reviews',
        quality:      options.quality      || 'auto',
        fetch_format: options.fetch_format || 'auto',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

/**
 * Upload a raw (non-image) file buffer to Cloudinary — used for Instant Quote
 * STL/OBJ models. resource_type:'raw' is required for Cloudinary to store the
 * file as-is instead of attempting image processing. public_id is randomised
 * server-side (never derived from the user-supplied filename) so an uploaded
 * name can't be used to guess/collide with another file's storage path.
 */
export function uploadRawBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: options.folder || 'triakar/instant-quote-models',
        public_id: options.public_id, // caller supplies a random id
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export { cloudinary };
