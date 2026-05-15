const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdminOrTeacher } = require('../middleware/role');
const {
  createStudentList,
  getStudentLists,
  getStudentList,
  updateStudentList,
  deleteStudentList,
  addStudentToList,
  removeStudentFromList,
  sortStudentList
} = require('../controllers/studentListController');

// Apply auth and teacher middleware to all routes
router.use(auth, isAdminOrTeacher);

// Student list CRUD routes
router.post('/', createStudentList);
router.get('/', getStudentLists);
router.get('/:id', getStudentList);
router.put('/:id', updateStudentList);
router.delete('/:id', deleteStudentList);

// Student management within lists
router.post('/:id/students', addStudentToList);
router.delete('/:id/students/:studentEmail', removeStudentFromList);
router.put('/:id/sort', sortStudentList);

module.exports = router;
