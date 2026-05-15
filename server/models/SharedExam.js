const mongoose = require('mongoose');

const SharedExamSchema = new mongoose.Schema({
  // The exam being shared
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  // The teacher who shared the exam
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Share link token (unique)
  shareToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Share type: 'link' (public link) or 'email' (specific invite)
  shareType: {
    type: String,
    enum: ['link', 'email', 'both'],
    default: 'link'
  },
  // Share settings
  settings: {
    // Allow anyone with link to access
    publicAccess: {
      type: Boolean,
      default: true
    },
    // Require password to access
    requirePassword: {
      type: Boolean,
      default: false
    },
    // Password if required
    password: {
      type: String,
      default: null
    },
    // Maximum number of students who can access
    maxStudents: {
      type: Number,
      default: null // null = unlimited
    },
    // Expiration date for the share
    expiresAt: {
      type: Date,
      default: null // null = never expires
    },
    // Allow multiple attempts
    allowMultipleAttempts: {
      type: Boolean,
      default: false
    },
    // Show results immediately after exam
    showResults: {
      type: Boolean,
      default: true
    },
    // Scheduled start time for the exam
    scheduledStart: {
      type: Date,
      default: null // null = available immediately
    },
    // Scheduled end time for the exam
    scheduledEnd: {
      type: Date,
      default: null // null = no end time
    }
  },
  // Students who have accessed this shared exam
  students: [{
    // Student reference (null if accessed via link without registration)
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Email of the student (for tracking)
    email: {
      type: String,
      default: null
    },
    // Name of the student
    name: {
      type: String,
      default: null
    },
    // Access method: 'link' or 'email'
    accessMethod: {
      type: String,
      enum: ['link', 'email', 'invite'],
      default: 'link'
    },
    // Whether they completed the exam
    hasCompleted: {
      type: Boolean,
      default: false
    },
    // Whether the exam is locked for this student (prevents retaking)
    isLocked: {
      type: Boolean,
      default: false
    },
    // Result reference if completed
    result: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Result',
      default: null
    },
    // When they first accessed
    firstAccessedAt: {
      type: Date,
      default: Date.now
    },
    // When they completed (if applicable)
    completedAt: {
      type: Date,
      default: null
    }
  }],
  // Invited emails (for email-based sharing)
  invitedEmails: [{
    email: {
      type: String,
      required: true
    },
    // Whether they've accepted the invite
    hasJoined: {
      type: Boolean,
      default: false
    },
    // Student reference if they joined
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Invite token
    inviteToken: {
      type: String,
      default: null
    },
    // When invited
    invitedAt: {
      type: Date,
      default: Date.now
    },
    // When they joined (if applicable)
    joinedAt: {
      type: Date,
      default: null
    }
  }],
  // Is this share active
  isActive: {
    type: Boolean,
    default: true
  },
  // Share statistics
  stats: {
    totalViews: {
      type: Number,
      default: 0
    },
    totalStarted: {
      type: Number,
      default: 0
    },
    totalCompleted: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate a unique share token
SharedExamSchema.statics.generateShareToken = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Update updatedAt on save
SharedExamSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if share has expired
SharedExamSchema.methods.isExpired = function() {
  if (!this.settings.expiresAt) return false;
  return new Date() > this.settings.expiresAt;
};

// Check if share has reached max students
SharedExamSchema.methods.isFull = function() {
  if (!this.settings.maxStudents) return false;
  return this.students.length >= this.settings.maxStudents;
};

// Check if exam is currently scheduled (within start and end time)
SharedExamSchema.methods.isScheduled = function() {
  const now = new Date();
  const startTime = this.settings.scheduledStart;
  const endTime = this.settings.scheduledEnd;

  // If no start time, exam is available
  if (!startTime) return true;

  // If before start time, not yet available
  if (now < startTime) return false;

  // If after end time, no longer available
  if (endTime && now > endTime) return false;

  return true;
};

// Check if exam is in the future (scheduled but not yet available)
SharedExamSchema.methods.isFuture = function() {
  const startTime = this.settings.scheduledStart;
  if (!startTime) return false;
  return new Date() < startTime;
};

// Lock exam for a student (prevent retaking)
SharedExamSchema.methods.lockStudent = function(studentId) {
  const student = this.students.find(
    s => s.student?.toString() === studentId || s.email === studentId
  );

  if (student) {
    student.isLocked = true;
    return true;
  }
  return false;
};

// Unlock exam for a student (allow retaking)
SharedExamSchema.methods.unlockStudent = function(studentId) {
  const student = this.students.find(
    s => s.student?.toString() === studentId || s.email === studentId
  );

  if (student) {
    student.isLocked = false;
    return true;
  }
  return false;
};

// Add a student to the share
SharedExamSchema.methods.addStudent = function(studentData) {
  const existingStudent = this.students.find(
    s => s.email === studentData.email || s.student?.toString() === studentData.studentId
  );

  if (existingStudent) {
    return { isNew: false, student: existingStudent };
  }

  const newStudent = {
    student: studentData.studentId || null,
    email: studentData.email,
    name: studentData.name,
    accessMethod: studentData.accessMethod || 'link',
    firstAccessedAt: new Date()
  };

  this.students.push(newStudent);
  return { isNew: true, student: newStudent };
};

// Mark student as completed
SharedExamSchema.methods.markCompleted = function(studentId, resultId) {
  const student = this.students.find(
    s => s.student?.toString() === studentId || s.email === studentId
  );

  if (student) {
    student.hasCompleted = true;
    student.result = resultId;
    student.completedAt = new Date();
    this.stats.totalCompleted += 1;
    return true;
  }
  return false;
};

// Increment view count
SharedExamSchema.methods.incrementViews = function() {
  this.stats.totalViews += 1;
};

// Increment started count
SharedExamSchema.methods.incrementStarted = function() {
  this.stats.totalStarted += 1;
};

// Increment completed count
SharedExamSchema.methods.incrementCompleted = function() {
  this.stats.totalCompleted += 1;
};

module.exports = mongoose.model('SharedExam', SharedExamSchema);
