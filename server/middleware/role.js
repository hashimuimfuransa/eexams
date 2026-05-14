// Middleware to check if user is an admin (organization) or superadmin
const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Organization admin role required.' });
};

// Middleware to check if user is an admin, superadmin, or teacher
const isAdminOrTeacher = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'teacher')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin or Teacher role required.' });
};

// Middleware to attach the organization admin ID to the request
// For superadmins: null (they see all data system-wide)
// For admins: uses their own ID
// For organization teachers: uses parentAdmin
// For individual teachers: uses their own ID (they are their own admin)
const attachOrgAdminId = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role === 'superadmin') {
    // Super admins have system-level access, no orgAdminId restriction
    req.orgAdminId = null;
  } else if (req.user.role === 'admin') {
    // Organization admins use their own ID
    req.orgAdminId = req.user._id;
  } else if (req.user.role === 'teacher') {
    if (req.user.parentAdmin) {
      // Organization-based teachers use their parent admin's ID
      req.orgAdminId = req.user.parentAdmin;
    } else {
      // Individual teachers use their own ID
      req.orgAdminId = req.user._id;
    }
  } else {
    return res.status(403).json({ message: 'Access denied. Admin or Teacher role required.' });
  }

  next();
};

// Middleware to check if user is a teacher (created by an admin)
const isTeacher = (req, res, next) => {
  if (req.user && req.user.role === 'teacher') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Teacher role required.' });
};

// Middleware to check if user is a student
const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Student role required.' });
};

// Middleware to check system lock status
const checkSystemLock = async (req, res, next) => {
  try {
    const SystemConfig = require('../models/SystemConfig');
    const config = await SystemConfig.getConfig();
    
    // If system is locked and user is not an admin, only allow exam routes
    if (config.isLocked && req.user.role !== 'admin') {
      // Allow access only to exam-related routes
      const allowedPaths = ['/api/exam', '/api/student/exams'];
      const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path));
      
      if (!isAllowedPath) {
        return res.status(403).json({ 
          message: config.lockMessage || 'The system is currently locked. Only exams are accessible.'
        });
      }
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error checking system lock status' });
  }
};

module.exports = {
  isAdmin,
  isAdminOrTeacher,
  attachOrgAdminId,
  isTeacher,
  isStudent,
  checkSystemLock
};
