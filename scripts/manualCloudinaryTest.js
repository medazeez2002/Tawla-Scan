import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadAndLog() {
  const filePath = path.resolve('uploads/menu-images/d17.png');
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'test-manual',
      transformation: [
        { width: 1200, crop: 'limit' },
        { fetch_format: 'auto', quality: 'auto' }
      ]
    });
    console.log('Cloudinary upload result:', result);
    const url = cloudinary.url(result.public_id, {
      transformation: [
        { width: 1200, crop: 'limit' },
        { fetch_format: 'auto', quality: 'auto' }
      ],
      secure: true,
      format: result.format
    });
    console.log('Cloudinary URL:', url);
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

uploadAndLog();
