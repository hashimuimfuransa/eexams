const mongoose = require('mongoose');

const StudentListSchema = new mongoose.Schema({
  // The teacher who owns this list
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Name of the student list
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Description of the list
  description: {
    type: String,
    default: ''
  },
  // Students in the list
  students: [{
    // Student name
    name: {
      type: String,
      required: true,
      trim: true
    },
    // Student email
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    // Student ID if they exist in the system
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }],
  // Sort order for the list
  sortOrder: {
    type: String,
    enum: ['name-asc', 'name-desc', 'email-asc', 'email-desc', 'custom'],
    default: 'custom'
  },
  // Whether this list is active
  isActive: {
    type: Boolean,
    default: true
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

// Update updatedAt on save
StudentListSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to sort students based on sortOrder
StudentListSchema.methods.sortStudents = function() {
  switch (this.sortOrder) {
    case 'name-asc':
      this.students.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      this.students.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'email-asc':
      this.students.sort((a, b) => a.email.localeCompare(b.email));
      break;
    case 'email-desc':
      this.students.sort((a, b) => b.email.localeCompare(a.email));
      break;
    case 'custom':
    default:
      // Keep custom order
      break;
  }
  return this.students;
};

// Static method to find all lists for a teacher
StudentListSchema.statics.findByTeacher = function(teacherId) {
  return this.find({ teacher: teacherId, isActive: true }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model('StudentList', StudentListSchema);
