const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const app = express();
const adminController = require('../controllers/adminController');
const User = require('../models/User');
const Exam = require('../models/Exam');
const SecurityAlert = require('../models/SecurityAlert');
const ActivityLog = require('../models/ActivityLog');

// Mock middleware
const mockAuth = (req, res, next) => {
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    role: 'admin'
  };
  next();
};

// Setup routes for testing
app.use(express.json());
app.use('/api/admin/students', mockAuth, adminController.registerStudent);
app.use('/api/admin/security-alerts', mockAuth, adminController.getSecurityAlerts);
app.use('/api/admin/security-alerts/:id/resolve', mockAuth, adminController.resolveSecurityAlert);
app.use('/api/admin/activity-logs', mockAuth, adminController.getActivityLogs);

// Mock the database models
jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../models/Exam', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../models/SecurityAlert', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../models/ActivityLog', () => ({
  find: jest.fn(),
  logActivity: jest.fn()
}));

describe('Admin Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Student Management', () => {
    test('registerStudent should create a new student', async () => {
      // Mock data
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        class: 'Grade 10',
        organization: 'Example School'
      };

      // Mock User.findOne to return null (no existing user)
      User.findOne.mockResolvedValue(null);

      // Mock User.create to return the new student
      const createdStudent = {
        _id: new mongoose.Types.ObjectId(),
        ...studentData,
        role: 'student'
      };
      User.create.mockResolvedValue(createdStudent);

      // Mock ActivityLog.logActivity
      ActivityLog.logActivity.mockResolvedValue({});

      // Make the request
      const response = await request(app)
        .post('/api/admin/students')
        .send(studentData);

      // Assertions
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.firstName).toBe(studentData.firstName);
      expect(response.body.lastName).toBe(studentData.lastName);
      expect(response.body.email).toBe(studentData.email);
      expect(response.body.role).toBe('student');
      expect(response.body.class).toBe(studentData.class);
      expect(response.body.organization).toBe(studentData.organization);

      // Verify User.findOne was called
      expect(User.findOne).toHaveBeenCalledWith({ email: studentData.email });

      // Verify User.create was called with correct data
      expect(User.create).toHaveBeenCalledWith({
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        email: studentData.email,
        password: studentData.password,
        role: 'student',
        class: studentData.class,
        organization: studentData.organization
      });

      // Verify ActivityLog.logActivity was called
      expect(ActivityLog.logActivity).toHaveBeenCalled();
    });

    test('registerStudent should return 400 if student already exists', async () => {
      // Mock data
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        class: 'Grade 10',
        organization: 'Example School'
      };

      // Mock User.findOne to return an existing user
      User.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        email: studentData.email
      });

      // Make the request
      const response = await request(app)
        .post('/api/admin/students')
        .send(studentData);

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Student with this email already exists');

      // Verify User.create was not called
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  describe('Security Alerts', () => {
    test('getSecurityAlerts should return all security alerts', async () => {
      // Mock data
      const mockAlerts = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'multiple_device',
          student: {
            _id: new mongoose.Types.ObjectId(),
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            class: 'Grade 10',
            organization: 'Example School'
          },
          description: 'Multiple device login detected',
          timestamp: new Date(),
          status: 'unresolved'
        }
      ];

      // Mock SecurityAlert.find
      SecurityAlert.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockAlerts)
          })
        })
      });

      // Make the request
      const response = await request(app)
        .get('/api/admin/security-alerts');

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('multiple_device');
      expect(response.body[0].status).toBe('unresolved');
    });

    test('resolveSecurityAlert should resolve an alert', async () => {
      // Mock data
      const alertId = new mongoose.Types.ObjectId();
      const mockAlert = {
        _id: alertId,
        type: 'multiple_device',
        student: new mongoose.Types.ObjectId(),
        description: 'Multiple device login detected',
        status: 'unresolved',
        resolve: jest.fn().mockResolvedValue({})
      };

      // Mock SecurityAlert.findById
      SecurityAlert.findById.mockResolvedValue(mockAlert);

      // Mock the populated alert after resolution
      const mockResolvedAlert = {
        ...mockAlert,
        status: 'resolved',
        student: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        },
        resolvedBy: {
          firstName: 'Admin',
          lastName: 'User'
        }
      };

      // Mock the second call to SecurityAlert.findById
      SecurityAlert.findById.mockResolvedValueOnce(mockAlert)
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockResolvedAlert)
          })
        });

      // Make the request
      const response = await request(app)
        .put(`/api/admin/security-alerts/${alertId}/resolve`)
        .send({ notes: 'Issue resolved' });

      // Assertions
      expect(response.status).toBe(200);
      expect(mockAlert.resolve).toHaveBeenCalled();
      expect(ActivityLog.logActivity).toHaveBeenCalled();
    });
  });

  describe('Activity Logs', () => {
    test('getActivityLogs should return all activity logs', async () => {
      // Mock data
      const mockLogs = [
        {
          _id: new mongoose.Types.ObjectId(),
          user: {
            _id: new mongoose.Types.ObjectId(),
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com'
          },
          action: 'login',
          timestamp: new Date(),
          details: {}
        }
      ];

      // Mock ActivityLog.find
      ActivityLog.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockLogs)
          })
        })
      });

      // Make the request
      const response = await request(app)
        .get('/api/admin/activity-logs');

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].action).toBe('login');
    });
  });
});
