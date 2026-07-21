const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../services/cloudinary');
const { optimizeAndUploadImage } = require('../utils/imageOptimizer');
require('dotenv').config();

// Ensure local temp folder exists for buffering uploads
const tempDir = path.join(__dirname, '../assets/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Local storage config
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}_${file.originalname.replace(/\s/g, '-')}`);
  }
});

// Helper to validate mime types and extensions for security
const fileFilterHelper = (allowedMimeTypes, allowedExtensions) => {
  return (req, file, cb) => {
    // 1. Check MIME type
    const mimeMatch = allowedMimeTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.mimetype.startsWith(type.replace('/*', ''));
      }
      return file.mimetype === type;
    });

    // 2. Check Extension
    const ext = file.originalname.split('.').pop().toLowerCase();
    const extMatch = allowedExtensions.includes(ext);

    if (mimeMatch && extMatch) {
      cb(null, true);
    } else {
      cb(new Error(`Security Alert: File type not allowed. Expected formats: ${allowedExtensions.join(', ')}`), false);
    }
  };
};

// Middleware wrapper that intercepts uploaded files and processes them
const optimizeImagesMiddleware = (defaultType, defaultFolder) => {
  return async (req, res, next) => {
    try {
      if (!req.file && !req.files) return next();

      const { SystemConfig } = require('../models/SystemSetting-model');
      const settings = await SystemConfig.findOne();
      if (settings && settings.uploadSettings) {
        const { maxImageSizeMB, allowedImageFormats } = settings.uploadSettings;
        if (maxImageSizeMB) {
          const maxBytes = maxImageSizeMB * 1024 * 1024;
          const checkSize = (file) => {
            if (file.size > maxBytes) {
              throw new Error(`Security Alert: File size exceeds the limit of ${maxImageSizeMB}MB`);
            }
          };
          if (req.file) checkSize(req.file);
          if (req.files) {
            if (Array.isArray(req.files)) {
              req.files.forEach(checkSize);
            } else if (typeof req.files === 'object') {
              Object.values(req.files).flat().forEach(checkSize);
            }
          }
        }
        if (allowedImageFormats && allowedImageFormats.length > 0) {
          const checkFormat = (file) => {
            const ext = file.originalname.split('.').pop().toLowerCase();
            if (!allowedImageFormats.map(f => f.toLowerCase()).includes(ext)) {
              throw new Error(`Security Alert: File extension .${ext} is not allowed. Allowed formats: ${allowedImageFormats.join(', ')}`);
            }
          };
          if (req.file) checkFormat(req.file);
          if (req.files) {
            if (Array.isArray(req.files)) {
              req.files.forEach(checkFormat);
            } else if (typeof req.files === 'object') {
              Object.values(req.files).flat().forEach(checkFormat);
            }
          }
        }
      }

      const processFile = async (file) => {
        let activeType = defaultType;
        let activeFolder = defaultFolder;

        // Dynamically adjust type/folder based on field name for unified uploads
        if (file.fieldname === 'profilePic') {
          activeType = 'profile';
          activeFolder = 'profilePics';
        } else if (file.fieldname === 'passbookImage') {
          activeType = 'work_completion'; // 100KB-300KB target
          activeFolder = 'passbookImage';
        } else if (file.fieldname === 'aadhaarFront') {
          activeType = 'work_completion';
          activeFolder = 'aadhaarFront';
        } else if (file.fieldname === 'aadhaarBack') {
          activeType = 'work_completion';
          activeFolder = 'aadhaarBack';
        } else if (file.fieldname === 'panCard') {
          activeType = 'work_completion';
          activeFolder = 'panCard';
        } else if (file.fieldname === 'liveSelfie') {
          activeType = 'work_completion';
          activeFolder = 'liveSelfie';
        } else if (file.fieldname === 'image' || file.fieldname === 'images') {
          activeType = 'service';
          activeFolder = 'serviceImage';
        } else if (file.fieldname === 'file') {
          activeType = 'work_completion';
          activeFolder = 'complaintImage';
        }

        // Direct upload without Sharp if PDF/raw file
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: activeFolder,
            resource_type: 'raw',
          });
          try { fs.unlinkSync(file.path); } catch (e) {}
          return {
            path: uploadResult.secure_url,
            filename: uploadResult.public_id,
            mimetype: file.mimetype
          };
        }

        // Run through Sharp optimization pipeline
        const result = await optimizeAndUploadImage(file.path, activeType, activeFolder);
        return {
          path: result.secure_url,
          filename: result.public_id,
          mimetype: 'image/webp'
        };
      };

      if (req.file) {
        const processed = await processFile(req.file);
        req.file.path = processed.path;
        req.file.filename = processed.filename;
        req.file.mimetype = processed.mimetype;
      }

      if (req.files) {
        if (Array.isArray(req.files)) {
          for (let i = 0; i < req.files.length; i++) {
            const processed = await processFile(req.files[i]);
            req.files[i].path = processed.path;
            req.files[i].filename = processed.filename;
            req.files[i].mimetype = processed.mimetype;
          }
        } else if (typeof req.files === 'object') {
          for (const fieldName of Object.keys(req.files)) {
            const filesList = req.files[fieldName];
            for (let i = 0; i < filesList.length; i++) {
              const processed = await processFile(filesList[i]);
              filesList[i].path = processed.path;
              filesList[i].filename = processed.filename;
              filesList[i].mimetype = processed.mimetype;
            }
          }
        }
      }

      next();
    } catch (error) {
      // Clean up local temp files on failure
      const cleanupLocalFile = (filePath) => {
        try {
          if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {}
      };

      if (req.file) cleanupLocalFile(req.file.path);
      if (req.files) {
        if (Array.isArray(req.files)) {
          req.files.forEach(f => cleanupLocalFile(f.path));
        } else if (typeof req.files === 'object') {
          Object.values(req.files).flat().forEach(f => cleanupLocalFile(f.path));
        }
      }

      if (error.message && error.message.includes('Security Alert')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  };
};

// Wrap multer helper to maintain compatibility
const wrapMulter = (multerInstance, type, folder) => {
  return {
    single: (fieldName) => [multerInstance.single(fieldName), optimizeImagesMiddleware(type, folder)],
    array: (fieldName, maxCount) => [multerInstance.array(fieldName, maxCount), optimizeImagesMiddleware(type, folder)],
    fields: (fieldsArray) => [multerInstance.fields(fieldsArray), optimizeImagesMiddleware(type, folder)]
  };
};

// Create Multer instances pointing to local temp storage
const maxUploadLimit = 20 * 1024 * 1024; // 20MB maximum accepted size

const rawProfilePic = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});


const rawServiceImage = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const rawComplaintImage = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const rawPassbookImg = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const rawServicesFile = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/octet-stream'], ['xlsx', 'xls'])
});

const rawSystemLogo = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif'])
});

const rawSystemFavicon = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'ico', 'heic', 'heif'])
});

const rawCategoryIcon = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'svg', 'heic', 'heif'])
});

const rawBannerImage = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif'])
});

const rawGeneral = multer({
  storage: localStorage,
  limits: { fileSize: maxUploadLimit },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

// Error handler middleware
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') message = `File too large (Max 20MB)`;
    if (err.code === 'LIMIT_FIELD_SIZE') message = 'Field data too large';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many files or unexpected field name';

    return res.status(400).json({
      success: false,
      message: `${message}: ${err.message}`,
      code: err.code
    });
  } else if (err) {
    const isSecurityError = err.message && err.message.includes('Security Alert');
    return res.status(isSecurityError ? 400 : 500).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }
  next();
};

module.exports = {
  upload: wrapMulter(rawGeneral, 'general', 'raj-electrical'),
  uploadProfilePic: wrapMulter(rawProfilePic, 'profile', 'profilePics'),
  uploadServiceImage: wrapMulter(rawServiceImage, 'service', 'serviceImage'),
  uploadComplaintImage: wrapMulter(rawComplaintImage, 'work_completion', 'complaintImage'),
  uploadPassbookImg: wrapMulter(rawPassbookImg, 'work_completion', 'passbookImage'),
  uploadServicesFile: rawServicesFile,
  uploadSystemLogo: wrapMulter(rawSystemLogo, 'service', 'systemLogo'),
  uploadSystemFavicon: wrapMulter(rawSystemFavicon, 'service', 'systemFavicon'),
  uploadCategoryIcon: wrapMulter(rawCategoryIcon, 'service', 'categoryIcon'),
  uploadBannerImage: wrapMulter(rawBannerImage, 'service', 'bannerImage'),
  handleUploadErrors,
};
