const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinary');
require('dotenv').config();

// General function to create Cloudinary Storage with specific folder and resource type
const createCloudinaryStorage = (folder, resourceType, allowedFormats) => {
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
        allowed_formats: allowedFormats,
        public_id: `${folder}_${Date.now()}_${file.originalname.split('.')[0].replace(/\s/g, '-')}`, // Ensure public_id is unique and descriptive and URL-safe
      };
    },
  });
};

// Upload instances for different types
const uploadProfilePic = multer({
  storage: createCloudinaryStorage('profilePics', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

const resumeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'resume',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => `resume_${Date.now()}_${file.originalname.split('.')[0].replace(/\s/g, '-')}`,
  },
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

const uploadServiceImage = multer({
  storage: createCloudinaryStorage('serviceImage', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
}).array('image', 3);

const uploadComplaintImage = multer({
  storage: createCloudinaryStorage('complaintImage', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadPassbookImg = multer({
  storage: createCloudinaryStorage('passbookImage', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

const uploadServicesFile = multer({
  storage: createCloudinaryStorage('servicesFile', 'image', ['jpg', 'jpeg', 'png']),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Error handler middleware
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large'
        : 'Multer file upload error',
    });
  } else if (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }
  next();
};

const upload = multer({
  storage: createCloudinaryStorage('raj-electrical', 'auto', ['jpg', 'jpeg', 'png']), // Files Save folder
  limits: { fileSize: 5 * 1024 * 1024 }, // General limit of 5MB
});

module.exports = {
  upload,
  uploadProfilePic,
  uploadResume,
  uploadServiceImage,
  uploadComplaintImage,
  uploadPassbookImg,
  uploadServicesFile,
  handleUploadErrors,
};
