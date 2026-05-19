const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinary');
require('dotenv').config();

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

// General function to create Cloudinary Storage with specific folder and resource type
const createCloudinaryStorage = (folder, resourceType, allowedFormats) => {
  // Automatically include HEIC/HEIF for image uploads
  let formats = allowedFormats;
  if (allowedFormats && (allowedFormats.includes('jpg') || allowedFormats.includes('jpeg') || allowedFormats.includes('png'))) {
    formats = Array.from(new Set([...allowedFormats, 'heic', 'heif']));
  }
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
      let resourceTypeResult = resourceType;
      if (file.mimetype === 'application/pdf') {
        resourceTypeResult = 'raw';
      } else if (file.mimetype === 'audio/mpeg') {
        resourceTypeResult = 'video';
      }
      return {
        folder: folder,
        resource_type: resourceTypeResult,
        allowed_formats: formats,
        public_id: `${folder}_${Date.now()}_${file.originalname.split('.')[0].replace(/\s/g, '-')}`, // Ensure public_id is unique and descriptive and URL-safe
      };
    },
  });
};

// Upload instances for different types with increased safe limits for high-res mobile cameras
const uploadProfilePic = multer({
  storage: createCloudinaryStorage('profilePics', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const resumeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'resume',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'heic', 'heif'],
    public_id: (req, file) => `resume_${Date.now()}_${file.originalname.split('.')[0].replace(/\s/g, '-')}`,
  },
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif', 'application/pdf'], ['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf'])
});

const uploadServiceImage = multer({
  storage: createCloudinaryStorage('serviceImage', 'image', ['jpg', 'jpeg', 'png']),
  limits: { 
    fileSize: 25 * 1024 * 1024, // 25MB
    fieldSize: 25 * 1024 * 1024 // 25MB to allow large JSON fields like specialNotes
  },
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const uploadComplaintImage = multer({
  storage: createCloudinaryStorage('complaintImage', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const uploadPassbookImg = multer({
  storage: createCloudinaryStorage('passbookImage', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

const uploadServicesFile = multer({
  storage: createCloudinaryStorage('servicesFile', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

// Upload instances for System Settings
const uploadSystemLogo = multer({
  storage: createCloudinaryStorage('systemLogo', 'image', ['jpg', 'jpeg', 'png', 'gif']),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif'])
});

const uploadSystemFavicon = multer({
  storage: createCloudinaryStorage('systemFavicon', 'image', ['jpg', 'jpeg', 'png', 'ico']),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'ico', 'heic', 'heif'])
});

// Upload instance for Category Icon
const uploadCategoryIcon = multer({
  storage: createCloudinaryStorage('categoryIcon', 'image', ['jpg', 'jpeg', 'png', 'svg']),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'svg', 'heic', 'heif'])
});

// Upload instance for Banner Image
const uploadBannerImage = multer({
  storage: createCloudinaryStorage('bannerImage', 'image', ['jpg', 'jpeg', 'png', 'gif']),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif'])
});

// Error handler middleware
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large (Max 25MB)';
    if (err.code === 'LIMIT_FIELD_SIZE') message = 'Field data too large';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many files or unexpected field name';

    return res.status(400).json({
      success: false,
      message: `${message}: ${err.message}`, // Including Multer's native message
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

const upload = multer({
  storage: createCloudinaryStorage('raj-electrical', 'auto', ['jpg', 'jpeg', 'png']), // Files Save folder
  limits: { fileSize: 25 * 1024 * 1024 }, // General limit of 25MB
  fileFilter: fileFilterHelper(['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'], ['jpg', 'jpeg', 'png', 'heic', 'heif'])
});

module.exports = {
  upload,
  uploadProfilePic,
  uploadResume,
  uploadServiceImage,
  uploadComplaintImage,
  uploadPassbookImg,
  uploadServicesFile,
  uploadSystemLogo,
  uploadSystemFavicon,
  uploadCategoryIcon,
  uploadBannerImage,
  handleUploadErrors,
};
