const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Performance middleware - compression for faster responses
app.use(compression());

// CORS middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://eexams-z1ob.onrender.com',
  'https://www.eexams.net/',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Temporarily allow all for debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware with optimized limits
app.use(express.json({ limit: '50mb' })); // Increased from 10mb to 50mb for large exam submissions
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increased from 10mb to 50mb

// Serve uploaded files - adjust for Render deployment
let uploadsPath;

// Try to use the primary uploads path first
try {
  // In production, try to use the Render disk mount point
  if (process.env.NODE_ENV === 'production') {
    // Check if a custom uploads path is specified
    const primaryPath = process.env.UPLOADS_PATH || '/var/data/uploads';

    if (fs.existsSync(primaryPath)) {
      // Directory exists, check if it's writable
      try {
        fs.accessSync(primaryPath, fs.constants.W_OK);
        uploadsPath = primaryPath;
        console.log('Using primary uploads directory:', uploadsPath);
      } catch (err) {
        console.warn('Primary uploads directory exists but is not writable, using fallback');
        uploadsPath = path.join(process.cwd(), 'tmp', 'uploads');
      }
    } else {
      // Try to create the directory
      try {
        fs.mkdirSync(primaryPath, { recursive: true });
        uploadsPath = primaryPath;
        console.log('Created primary uploads directory:', uploadsPath);
      } catch (err) {
        console.warn('Could not create primary uploads directory, using fallback:', err.message);
        uploadsPath = path.join(process.cwd(), 'tmp', 'uploads');
      }
    }
  } else {
    // In development, use the local uploads directory
    uploadsPath = path.join(__dirname, '../uploads');
  }

  // Ensure the uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('Created uploads directory:', uploadsPath);
  }
} catch (err) {
  // Final fallback if everything else fails
  console.error('Error setting up uploads directory:', err);
  uploadsPath = path.join(process.cwd(), 'tmp', 'uploads');

  // Create the fallback directory
  if (!fs.existsSync(uploadsPath)) {
    try {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log('Created fallback uploads directory:', uploadsPath);
    } catch (innerErr) {
      console.error('Failed to create fallback uploads directory:', innerErr);
      // At this point, we'll just use the path but uploads won't work
    }
  }
}

// Use the determined uploads path
app.use('/uploads', express.static(uploadsPath));

// Log the final uploads path for debugging
console.log('Final uploads path:', uploadsPath);

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const examRoutes = require('./routes/exam');
const profileRoutes = require('./routes/profile');
const superAdminRoutes = require('./routes/superAdmin');
const shareRoutes = require('./routes/share');
const studentListRoutes = require('./routes/studentList');
const marketplaceRoutes = require('./routes/marketplace');
const questionBankRoutes = require('./routes/questionBank');
const contactRoutes = require('./routes/contact');
const reclamationRoutes = require('./routes/reclamationRoutes');
const seoController = require('./controllers/seoController');

// Import subscription expiration middleware
const { blockExpiredUsers } = require('./middleware/subscriptionExpiration');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', blockExpiredUsers, adminRoutes);
app.use('/api/student', blockExpiredUsers, studentRoutes);
app.use('/api/exam', blockExpiredUsers, examRoutes);
app.use('/api/profile', blockExpiredUsers, profileRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/student-lists', blockExpiredUsers, studentListRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/reclamations', reclamationRoutes);

// Log registered routes for debugging
console.log('Registered API routes:');
console.log('- /api/auth/* (Authentication routes)');
console.log('- /api/admin/* (Admin routes)');
console.log('- /api/student/* (Student routes)');
console.log('- /api/exam/* (Exam routes)');
console.log('- /api/profile/* (Profile routes)');
console.log('- /api/superadmin/* (Super Admin routes)');
console.log('  - GET /api/superadmin/users');
console.log('  - DELETE /api/superadmin/users/:id');
console.log('  - PUT /api/superadmin/users/:id/toggle-block');
console.log('- /api/share/* (Share/Link routes)');
console.log('- /api/results/* (Results routes)');
console.log('- /api/public/* (Public exam routes)');
console.log('- /api/marketplace/* (Marketplace routes)');
console.log('- /api/exam/test-routes (Debug route)');
console.log('- /api/exam/:id/select-question (Question selection route)');

// Global error handler for uncaught errors (including multipart parsing errors)
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err.message);
  
  // Handle multer/busboy errors
  if (err.message && err.message.includes('Unexpected end of form')) {
    return res.status(400).json({ 
      message: 'Upload was interrupted. Please check your connection and try again.',
      error: 'UPLOAD_INTERRUPTED'
    });
  }
  
  // Handle file size errors
  if (err.code === 'LIMIT_FILE_SIZE' || err.message.includes('file too large')) {
    return res.status(413).json({ 
      message: 'File too large. Maximum size is 50MB.',
      error: 'FILE_TOO_LARGE'
    });
  }
  
  // Handle unexpected file field errors
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      message: 'Unexpected file field. Please use the correct file upload field.',
      error: 'UNEXPECTED_FILE'
    });
  }
  
  // Generic error response
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Performance monitoring endpoint
app.get('/api/performance', (req, res) => {
  const cacheService = require('./utils/cacheService');
  const cacheStats = cacheService.getStats();
  
  res.status(200).json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cacheStats,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// SEO endpoints
app.get('/sitemap.xml', seoController.generateSitemap);

// Optimize mongoose settings for faster performance
mongoose.set('bufferCommands', false); // Disable mongoose buffering for faster responses

// Process-level error handling to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
  // Don't exit immediately - let the global error handler deal with it
  if (err.message && err.message.includes('Unexpected end of form')) {
    console.log('Form parsing error caught at process level - server continuing');
    return; // Don't crash for this specific error
  }
  // For other uncaught exceptions, exit gracefully after a delay
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue running - don't crash
});

// Robust MongoDB connection with retry logic
const MAX_DB_RETRIES = 5;
const DB_RETRY_DELAY = 3000;

const connectWithRetry = async (retries = 0) => {
  try {
    // Validate MONGODB_URI before attempting connection
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    if (typeof process.env.MONGODB_URI !== 'string' || process.env.MONGODB_URI.trim() === '') {
      throw new Error('MONGODB_URI is empty or invalid');
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI format:', process.env.MONGODB_URI.substring(0, 20) + '...');

    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Connected to MongoDB with optimized settings');

    // Start background job to check for expired exams
    try {
      const { checkExpiredExams } = require('./utils/examExpirationChecker');

      // Run every minute to check for expired exams
      cron.schedule('* * * * *', async () => {
        try {
          await checkExpiredExams();
        } catch (error) {
          console.error('Error in expired exam checker cron job:', error);
        }
      });

      console.log('🕐 Started background job to check for expired exams (runs every minute)');
    } catch (error) {
      console.error('Failed to load examExpirationChecker:', error);
      console.log('Server will continue without expired exam checking');
    }
    
    // Start server only after successful connection
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} with performance optimizations`);
    });
    
  } catch (err) {
    console.error(`MongoDB connection attempt ${retries + 1} failed:`, err.message);
    console.error('Full error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      reason: err.reason
    });

    if (retries < MAX_DB_RETRIES) {
      console.log(`Retrying in ${DB_RETRY_DELAY}ms... (${retries + 1}/${MAX_DB_RETRIES})`);
      setTimeout(() => connectWithRetry(retries + 1), DB_RETRY_DELAY);
    } else {
      console.error('Max retries reached. Could not connect to MongoDB.');
      console.error('Please check your MONGODB_URI in the .env file');
      console.error('Common issues:');
      console.error('1. Connection string is incomplete or malformed');
      console.error('2. Password contains special characters that need URL encoding');
      console.error('3. MongoDB Atlas cluster is not accessible from your network');
      console.error('4. IP whitelist in MongoDB Atlas does not include your IP');
      process.exit(1);
    }
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Will attempt to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});

// Initial connection
connectWithRetry();
