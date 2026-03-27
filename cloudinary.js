
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Example: Upload an image from a local path or URL
export async function uploadImage(source, publicId = undefined, options = {}) {
  try {
    const uploadResult = await cloudinary.uploader.upload(source, {
      public_id: publicId,
      ...options,
    });
    return uploadResult;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

// Example: Get an optimized image URL (auto format & quality)
export function getOptimizedImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    ...options,
  });
}

// Example: Get a cropped image URL (auto crop to square)
export function getAutoCropUrl(publicId, width = 500, height = 500, options = {}) {
  return cloudinary.url(publicId, {
    crop: 'auto',
    gravity: 'auto',
    width,
    height,
    ...options,
  });
}

export default cloudinary;
