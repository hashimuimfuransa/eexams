const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      'login',
      'logout',
      'create_exam',
      'edit_exam',
      'delete_exam',
      'lock_exam',
      'unlock_exam',
      'schedule_exam',
      'update_exam_schedule',
      'add_student',
      'edit_student',
      'delete_student',
      'resolve_alert',
      'ignore_alert',
      'system_lock',
      'system_unlock',
      'export_results',
      'grade_exam',
      'edit_profile'
    ],
    required: true
  },
  details: {
    type: Object,
    default: {}
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Static method to log an activity
ActivityLogSchema.statics.logActivity = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to prevent disrupting the main application flow
    return null;
  }
};

// Static method to get recent activities for a user
ActivityLogSchema.statics.getRecentActivities = async function(userId, limit = 10) {
  try {
    return await this.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
};

// Static method to get recent activities for the dashboard
ActivityLogSchema.statics.getRecentDashboardActivities = async function(limit = 10) {
  try {
    return await this.find({})
      .populate('user', 'firstName lastName')
      .sort({ timestamp: -1 })
      .limit(limit);
  } catch (error) {
    console.error('Error getting dashboard activities:', error);
    return [];
  }
};

// Format the activity for display
ActivityLogSchema.methods.formatForDisplay = function() {
  const formattedActivity = {
    id: this._id,
    user: this.user,
    action: this.action,
    timestamp: this.timestamp
  };

  // Format the activity based on the action type
  switch (this.action) {
    case 'create_exam':
      formattedActivity.type = 'exam_created';
      formattedActivity.exam = this.details.examTitle;
      break;
    case 'schedule_exam':
      formattedActivity.type = 'exam_scheduled';
      formattedActivity.exam = this.details.examTitle;
      formattedActivity.scheduledFor = this.details.scheduledFor;
      break;
    case 'update_exam_schedule':
      formattedActivity.type = 'exam_schedule_updated';
      formattedActivity.exam = this.details.examTitle;
      formattedActivity.scheduledFor = this.details.scheduledFor;
      break;
    case 'add_student':
      formattedActivity.type = 'student_added';
      formattedActivity.student = this.details.studentName;
      break;
    case 'resolve_alert':
    case 'ignore_alert':
      formattedActivity.type = 'security_alert';
      formattedActivity.student = this.details.studentName;
      formattedActivity.issue = this.details.alertType;
      formattedActivity.action = this.action === 'resolve_alert' ? 'resolved' : 'ignored';
      break;
    default:
      formattedActivity.type = this.action;
      break;
  }

  return formattedActivity;
};

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
