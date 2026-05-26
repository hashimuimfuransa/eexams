const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for question images (optimized for web display)
const questionImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eexams/question-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `img-${uniqueSuffix}`;
    },
  },
});

// Storage for exam documents (PDF, Word, etc.)
const examFileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eexams/exam-files',
    resource_type: 'raw', // Always use raw for documents
    // Don't use allowed_formats - it causes issues with .doc files
    // File validation is handled by multer fileFilter instead
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const cleanName = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
      return `exam-${cleanName}-${uniqueSuffix}`;
    },
  },
});

// Storage for reference materials (AI training/docs)
const referenceFileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eexams/reference-files',
    resource_type: 'raw',
    // Don't use allowed_formats - it causes issues with .doc files
    // File validation is handled by multer fileFilter instead
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const cleanName = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
      return `ref-${cleanName}-${uniqueSuffix}`;
    },
  },
});

// Storage for answer keys and marking guides
const answerKeyStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eexams/answer-keys',
    resource_type: 'raw',
    // Don't use allowed_formats - it causes issues with .doc files
    // File validation is handled by multer fileFilter instead
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const cleanName = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-')
      return `answer-${cleanName}-${uniqueSuffix}`;
    },
  },
});

// Storage for student result attachments (if needed)
const resultAttachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eexams/result-attachments',
    resource_type: 'auto', // Auto-detect image vs raw
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `result-${uniqueSuffix}`;
    },
  },
});

module.exports = { 
  cloudinary, 
  questionImageStorage, 
  examFileStorage,
  referenceFileStorage,
  answerKeyStorage,
  resultAttachmentStorage
};
