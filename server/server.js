const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Performance middleware - compression for faster responses
app.use(compression());

// CORS middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'https://testfyrwanda.vercel.app'
    : 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware with optimized limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
const resultsRoutes = require('./routes/results');
const studentListRoutes = require('./routes/studentList');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/student-lists', studentListRoutes);

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
console.log('- /api/exam/test-routes (Debug route)');
console.log('- /api/exam/:id/select-question (Question selection route)');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Optimize mongoose settings for faster performance
mongoose.set('bufferCommands', false); // Disable mongoose buffering for faster responses

// Connect to MongoDB with optimized settings for faster performance
mongoose.connect(process.env.MONGODB_URI, {
  // Connection pool settings for better performance
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  // Optimize for faster authentication
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
})
  .then(() => {
    console.log('Connected to MongoDB with optimized settings');

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} with performance optimizations`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
