// middlewares/upload.js
const multer = require('multer');
const path = require('path');

// Resume upload configuration
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/resumes/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + ext);
  }
});

// Profile picture upload configuration
const profilePicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profilePics/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// Add this to your existing upload.js file
const serviceImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/serviceImages/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'service-' + uniqueSuffix + ext);
  }
});



// File filters
const resumeFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for resumes'), false);
  }
};

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for profile pictures'), false);
  }
};

const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: resumeFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadProfilePic = multer({
  storage: profilePicStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 2MB limit
});

const uploadServiceImage = multer({
  storage: serviceImageStorage,
  fileFilter: imageFilter, // Reuse the same image filter
  limits: { fileSize: 3 * 1024 * 1024 } // 2MB limit
});

module.exports = {
  uploadResume,
  uploadProfilePic,
  uploadServiceImage
};