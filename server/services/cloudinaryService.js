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

export { cloudinary };
