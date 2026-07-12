const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../services/cloudinary');

/**
 * Validate, resize, convert to WebP, compress to target size, and upload an image to Cloudinary.
 * 
 * @param {string} localFilePath - Local path of the temp file.
 * @param {string} type - Optimization target type: 'profile', 'service', 'work_completion', or 'general'
 * @param {string} folder - Cloudinary folder name.
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
const optimizeAndUploadImage = async (localFilePath, type = 'general', folder = 'raj-electrical') => {
  try {
    // 1. Security Check: Validate file exists and is a valid image
    if (!fs.existsSync(localFilePath)) {
      throw new Error('File does not exist');
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const originalSize = fileBuffer.length;

    let metadata;
    try {
      metadata = await sharp(fileBuffer).metadata();
    } catch (err) {
      // Delete corrupt/invalid temp file for security
      try { fs.unlinkSync(localFilePath); } catch (e) {}
      throw new Error('Security Alert: Corrupted or invalid image file structure.');
    }

    if (!metadata || !metadata.format) {
      try { fs.unlinkSync(localFilePath); } catch (e) {}
      throw new Error('Security Alert: Non-image file or invalid format.');
    }

    // 2. Set Target Size Thresholds (in bytes)
    let minSize = 100 * 1024; // 100KB
    let maxSize = 300 * 1024; // 300KB

    if (type === 'profile') {
      minSize = 50 * 1024;
      maxSize = 150 * 1024;
    } else if (type === 'service') {
      minSize = 100 * 1024;
      maxSize = 250 * 1024;
    } else if (type === 'work_completion') {
      minSize = 100 * 1024;
      maxSize = 300 * 1024;
    }

    // 3. Initialize Sharp Pipeline with Resize if > 1920px width
    let pipeline = sharp(fileBuffer);
    if (metadata.width > 1920) {
      pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
    }

    // 4. Iterative Compression Loop to hit the Target Range
    let quality = 80;
    let compressedBuffer;
    let attempts = 0;
    const maxAttempts = 4;

    do {
      compressedBuffer = await pipeline
        .clone()
        .withMetadata()
        .webp({ quality, effort: 4 })
        .toBuffer();

      const currentSize = compressedBuffer.length;

      // Adjust quality based on size
      if (currentSize > maxSize && quality > 30) {
        quality = Math.max(30, quality - 15);
      } else if (currentSize < minSize && quality < 95 && attempts < 2) {
        quality = Math.min(95, quality + 10);
      } else {
        break;
      }
      attempts++;
    } while (attempts < maxAttempts);

    // 5. Upload Compressed WebP Buffer to Cloudinary
    const cloudinaryUploadOptions = {
      folder: folder,
      resource_type: 'image',
      format: 'webp',
      public_id: `${folder}_${Date.now()}_${path.basename(localFilePath, path.extname(localFilePath)).replace(/\s/g, '-')}`,
    };

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        cloudinaryUploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(compressedBuffer);
    });

    // 6. Monitoring and Logging
    const compressedSize = compressedBuffer.length;
    const originalSizeMB = (originalSize / (1024 * 1024)).toFixed(2) + 'MB';
    const compressedSizeKB = (compressedSize / 1024).toFixed(0) + 'KB';
    const reductionPercent = ((1 - (compressedSize / originalSize)) * 100).toFixed(1) + '%';

    console.log(`[Image Optimization Log]
Type: ${type}
Original: ${originalSizeMB} (${originalSize} bytes)
Compressed: ${compressedSizeKB} (${compressedSize} bytes)
Reduction: ${reductionPercent}
Target Range: ${(minSize / 1024).toFixed(0)}KB - ${(maxSize / 1024).toFixed(0)}KB`);

    // 7. Cleanup Local Temp File
    try {
      fs.unlinkSync(localFilePath);
    } catch (cleanupError) {
      console.error('Failed to clean up temp file:', cleanupError);
    }

    return {
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    };
  } catch (error) {
    // Make sure we delete local file on error
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (e) {}
    throw error;
  }
};

module.exports = {
  optimizeAndUploadImage,
};
