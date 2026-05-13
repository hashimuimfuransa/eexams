# National Score - Online Exam Management System

A full-stack online exam management system with AI-assisted grading.

## Features

### Admin Features
- Register and manage students
- Upload exams by uploading a document (Word or PDF)
- Automatic organization of exams into structured format
- Set time limits for exams
- Lock/unlock individual exams
- Lock/unlock the entire system
- View student results and export as CSV
- AI-assisted grading for open-ended questions

### Student Features
- Login and see available exams
- Take exams with timer
- Answer multiple choice and open-ended questions
- View results and correct answers

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB
- **Frontend**: React.js with Material UI
- **AI Integration**: Google Gemini API for grading open-ended questions

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Google Gemini API key

## Installation

### Backend Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/nationalscore.git
   cd nationalscore
   ```

2. Install backend dependencies:
   ```
   cd server
   npm install
   ```

3. Create a `.env` file in the server directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/nationalscore
   JWT_SECRET=your_jwt_secret_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Start the backend server:
   ```
   npm run dev
   ```

### Frontend Setup

1. Install frontend dependencies:
   ```
   cd client
   npm install
   ```

2. Start the frontend development server:
   ```
   npm start
   ```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/change-password` - Change password

### Admin Endpoints
- `POST /api/admin/students` - Register a new student
- `GET /api/admin/students` - Get all students
- `GET /api/admin/students/:id` - Get student by ID
- `PUT /api/admin/students/:id` - Update student
- `DELETE /api/admin/students/:id` - Delete student
- `PUT /api/admin/system-lock` - Lock/unlock system
- `GET /api/admin/system-lock` - Get system lock status
- `GET /api/admin/exams/:examId/results` - Get exam results
- `GET /api/admin/results/:resultId` - Get detailed result
- `GET /api/admin/exams/:examId/results/export` - Export exam results as CSV

### Exam Endpoints
- `POST /api/exam` - Create a new exam
- `GET /api/exam` - Get all exams
- `GET /api/exam/:id` - Get exam by ID
- `PUT /api/exam/:id` - Update exam
- `DELETE /api/exam/:id` - Delete exam
- `PUT /api/exam/:id/toggle-lock` - Toggle exam lock status
- `POST /api/exam/:id/start` - Start an exam
- `POST /api/exam/:id/answer` - Submit an answer
- `POST /api/exam/:id/complete` - Complete an exam
- `POST /api/exam/grade/:resultId` - Grade open-ended answers manually
- `POST /api/exam/ai-grade/:resultId` - Trigger AI grading

### Student Endpoints
- `GET /api/student/exams` - Get available exams
- `GET /api/student/exams/:examId/session` - Get current exam session
- `GET /api/student/results` - Get student's exam results
- `GET /api/student/results/:resultId` - Get detailed result

## License

This project is licensed under the MIT License.
