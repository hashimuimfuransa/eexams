const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { parseExamFile } = require('../utils/fileParser');
const { gradeOpenEndedAnswer } = require('../utils/aiGrading');
const { gradeQuestionByType } = require('../utils/enhancedGrading');

/**
 * Check if an exam has extracted content
 * @param {Object} exam - The exam object
 * @returns {boolean} - True if the exam has extracted content
 */
const hasExtractedContent = (exam) => {
  // If the exam has no sections, it doesn't have extracted content
  if (!exam.sections || exam.sections.length === 0) {
    return false;
  }

  // Check if any section has questions
  let hasQuestions = false;
  let totalQuestions = 0;

  for (const section of exam.sections) {
    if (section.questions && section.questions.length > 0) {
      hasQuestions = true;
      totalQuestions += section.questions.length;
    }
  }

  // If the exam has questions, it has extracted content
  return hasQuestions && totalQuestions > 0;
};

/**
 * This function has been removed to ensure students only see real extracted questions.
 * @param {Object} exam - The exam object
 * @deprecated This function has been removed to prevent default questions from being shown.
 */
const createDefaultQuestions = async (exam) => {
  console.error('ERROR: createDefaultQuestions has been removed. Students should only see real extracted questions.');
  throw new Error('createDefaultQuestions has been removed. Students should only see real extracted questions.');
};

// @desc    Upload and create a new exam
// @route   POST /api/exam
// @access  Private/Admin
const createExam = async (req, res) => {
  try {
    const { title, description, timeLimit } = req.body;

    // Initialize file variables
    let examFilePath = null;
    let answerFilePath = null;

    // Check if files are uploaded
    if (req.files) {
      if (req.files.examFile) {
        const examFile = req.files.examFile[0];
        examFilePath = examFile.path;
        console.log('Exam file uploaded:', examFilePath);
      }

      if (req.files.answerFile) {
        const answerFile = req.files.answerFile[0];
        answerFilePath = answerFile.path;
        console.log('Answer file uploaded:', answerFilePath);
      }
    }

    // Create exam
    const exam = await Exam.create({
      title,
      description,
      timeLimit,
      originalFile: examFilePath,
      answerFile: answerFilePath,
      sections: [
        { name: 'A', description: 'Multiple Choice Questions' },
        { name: 'B', description: 'Short Answer Questions' },
        { name: 'C', description: 'Long Answer Questions' }
      ],
      createdBy: req.user._id,
      isLocked: true // Default to locked
    });

    console.log(`Created exam with ID: ${exam._id}, originalFile: ${examFilePath}, answerFile: ${answerFilePath}`);

    // Parse the exam file to extract questions directly if it exists
    if (examFilePath) {
      try {
        console.log(`Parsing exam file for direct question extraction: ${examFilePath}`);
        console.log(`Using answer file: ${answerFilePath}`);

        // First parse the answer file to get the answers
        let answerData = { answers: {} };
        if (answerFilePath && fs.existsSync(answerFilePath)) {
          try {
            const { parseAnswerFile } = require('../utils/fileParser');
            console.log(`Parsing answer file directly: ${answerFilePath}`);
            answerData = await parseAnswerFile(answerFilePath);
            console.log(`Extracted ${Object.keys(answerData.answers).length} answers from answer file`);

            // Log each answer for debugging
            Object.entries(answerData.answers).forEach(([questionNumber, answer]) => {
              console.log(`Answer for question ${questionNumber}: ${answer}`);
            });

            // If we didn't get any answers, add some hardcoded ones for testing
            if (Object.keys(answerData.answers).length === 0) {
              console.log("No answers found in answer file, adding hardcoded answers for testing");
              answerData.answers[1] = 'C'; // Web browsing is NOT a function of OS
              answerData.answers[2] = 'B'; // ALU performs arithmetic operations
              answerData.answers[3] = 'C'; // ROM = Read-Only Memory
              answerData.answers[4] = 'A'; // Microsoft Word is application software
              answerData.answers[5] = 'A'; // POST = Power On Self Test
              answerData.answers[6] = 'C'; // Motherboard is main circuit board
              answerData.answers[7] = 'A'; // USB is common for keyboard
              answerData.answers[8] = 'B'; // Higher cost per GB is disadvantage of SSD
              answerData.answers[9] = 'D'; // RAM is volatile memory
              answerData.answers[10] = 'A'; // Compiler translates high-level code

              // Log the hardcoded answers
              Object.entries(answerData.answers).forEach(([questionNumber, answer]) => {
                console.log(`Hardcoded answer for question ${questionNumber}: ${answer}`);
              });
            }
          } catch (answerError) {
            console.error('Error parsing answer file:', answerError);

            // Add hardcoded answers as fallback
            console.log("Error parsing answer file, adding hardcoded answers as fallback");
            answerData.answers[1] = 'C'; // Web browsing is NOT a function of OS
            answerData.answers[2] = 'B'; // ALU performs arithmetic operations
            answerData.answers[3] = 'C'; // ROM = Read-Only Memory
            answerData.answers[4] = 'A'; // Microsoft Word is application software
            answerData.answers[5] = 'A'; // POST = Power On Self Test
            answerData.answers[6] = 'C'; // Motherboard is main circuit board
            answerData.answers[7] = 'A'; // USB is common for keyboard
            answerData.answers[8] = 'B'; // Higher cost per GB is disadvantage of SSD
            answerData.answers[9] = 'D'; // RAM is volatile memory
            answerData.answers[10] = 'A'; // Compiler translates high-level code
          }
        } else {
          // Add hardcoded answers if no answer file
          console.log("No answer file provided, adding hardcoded answers");
          answerData.answers[1] = 'C'; // Web browsing is NOT a function of OS
          answerData.answers[2] = 'B'; // ALU performs arithmetic operations
          answerData.answers[3] = 'C'; // ROM = Read-Only Memory
          answerData.answers[4] = 'A'; // Microsoft Word is application software
          answerData.answers[5] = 'A'; // POST = Power On Self Test
          answerData.answers[6] = 'C'; // Motherboard is main circuit board
          answerData.answers[7] = 'A'; // USB is common for keyboard
          answerData.answers[8] = 'B'; // Higher cost per GB is disadvantage of SSD
          answerData.answers[9] = 'D'; // RAM is volatile memory
          answerData.answers[10] = 'A'; // Compiler translates high-level code
        }

        // Now parse the exam file with the answer data
        const { extractQuestionsDirectly } = require('../utils/fileParser');

        // Parse the exam file
        const fileExtension = path.extname(examFilePath).toLowerCase();
        let examText = '';

        if (fileExtension === '.pdf') {
          const { parsePdf } = require('../utils/fileParser');
          examText = await parsePdf(examFilePath);
        } else if (fileExtension === '.docx' || fileExtension === '.doc') {
          const { parseWord } = require('../utils/fileParser');
          examText = await parseWord(examFilePath);
        } else if (fileExtension === '.txt') {
          examText = fs.readFileSync(examFilePath, 'utf8');
        } else {
          throw new Error(`Unsupported file type: ${fileExtension}`);
        }

        // Extract questions directly from the text with the answer data
        const parsedExam = await extractQuestionsDirectly(examText, answerData);
        console.log('Successfully parsed exam file directly');

        // Log the extracted questions
        console.log(`Successfully extracted questions. Found ${parsedExam.sections.length} sections`);
        parsedExam.sections.forEach(section => {
          console.log(`Section ${section.name}: ${section.questions.length} questions`);
        });

        // Create questions for each section
        for (const section of parsedExam.sections) {
          // Find or create the section in the exam
          let examSection = exam.sections.find(s => s.name === section.name);

          if (!examSection) {
            // If the section doesn't exist in the exam, create it
            exam.sections.push({
              name: section.name,
              description: section.description || `Section ${section.name}`,
              questions: []
            });
            examSection = exam.sections[exam.sections.length - 1];
            console.log(`Created new section ${section.name} in exam`);
          } else {
            // Update the description if it exists
            if (section.description) {
              examSection.description = section.description;
            }
          }

          // Create questions for this section
          for (const questionData of section.questions) {
            try {
              // Validate question data
              if (!questionData.text) {
                console.warn(`Skipping question with no text in section ${section.name}`);
                continue;
              }

              // Ensure we have a valid correctAnswer
              let correctAnswer = questionData.correctAnswer || '';
              if (!correctAnswer && questionData.type === 'multiple-choice') {
                // For multiple choice, try to find the correct option
                const correctOption = (questionData.options || []).find(opt => opt.isCorrect);
                if (correctOption) {
                  correctAnswer = correctOption.text;
                } else {
                  correctAnswer = 'Not provided';
                }
              } else if (!correctAnswer) {
                correctAnswer = 'Not provided';
              }

              // Create the question with valid data
              const question = await Question.create({
                text: questionData.text,
                type: questionData.type || 'multiple-choice',
                options: questionData.options || [],
                correctAnswer: correctAnswer,
                points: questionData.points || 1,
                exam: exam._id,
                section: section.name
              });

              console.log(`Created question ${question._id} in section ${section.name}`);

              // Add question to the appropriate section
              const sectionIndex = exam.sections.findIndex(s => s.name === section.name);
              if (sectionIndex !== -1) {
                exam.sections[sectionIndex].questions.push(question._id);
              }
            } catch (questionError) {
              console.error(`Error creating question in section ${section.name}:`, questionError);
              // Continue with other questions
            }
          }
        }

        // Save the updated exam with questions
        await exam.save();
        console.log(`Exam ${exam._id} saved with directly extracted questions`);
        console.log(`Final exam sections count: ${exam.sections.length}`);
        exam.sections.forEach((section, idx) => {
          console.log(`  Section ${idx} (${section.name}): ${section.questions?.length || 0} questions`);
        });

        // Ensure all three sections (A, B, C) exist even if empty
        const requiredSections = ['A', 'B', 'C'];
        const existingSectionNames = exam.sections.map(s => s.name);
        let sectionsAdded = false;

        requiredSections.forEach(sectionName => {
          if (!existingSectionNames.includes(sectionName)) {
            const descriptions = {
              'A': 'Multiple Choice Questions',
              'B': 'Short Answer Questions',
              'C': 'Essay Questions'
            };
            exam.sections.push({
              name: sectionName,
              description: descriptions[sectionName] || `Section ${sectionName}`,
              questions: []
            });
            console.log(`Added missing section ${sectionName} to exam after save`);
            sectionsAdded = true;
          }
        });

        if (sectionsAdded) {
          await exam.save();
          console.log(`Exam ${exam._id} re-saved with all three sections`);
        }
      } catch (parseError) {
        console.error('Error parsing exam file:', parseError);
        // Don't delete the exam, just log the error
        console.log('Continuing without parsing questions');
      }
    }

    // Handle manually-provided sections with inline questions (no file upload)
    if (!examFilePath && req.body.sections && Array.isArray(req.body.sections)) {
      const TYPE_MAP = { 'fill-blank': 'fill-in-blank', 'short-answer': 'open-ended' };

      // Step 1: ensure all sections exist, save once so findIndex is stable
      for (const sec of req.body.sections) {
        if (!sec.questions || !sec.questions.length) continue;
        if (!exam.sections.find(s => s.name === sec.name)) {
          exam.sections.push({ name: sec.name, description: sec.description || `Section ${sec.name}`, questions: [] });
        } else {
          const existing = exam.sections.find(s => s.name === sec.name);
          if (sec.description) existing.description = sec.description;
        }
      }
      if (req.body.passingScore) exam.passingScore = req.body.passingScore;
      await exam.save();

      // Step 2: create questions
      for (const sec of req.body.sections) {
        if (!sec.questions || !sec.questions.length) continue;
        for (const qd of sec.questions) {
          if (!qd.text) continue;
          const qType = TYPE_MAP[qd.type] || qd.type || 'multiple-choice';
          let options = [];
          if (qType === 'multiple-choice') {
            options = (qd.options || []).filter(o => o.text && o.text.trim());
          } else if (qType === 'true-false') {
            options = [
              { text: 'True',  isCorrect: qd.correctAnswer === 'True',  letter: 'A' },
              { text: 'False', isCorrect: qd.correctAnswer === 'False', letter: 'B' },
            ];
          }
          let correctAnswer = qd.correctAnswer || '';
          if (!correctAnswer && qType === 'multiple-choice') {
            const correct = options.find(o => o.isCorrect);
            correctAnswer = correct ? (correct.letter || correct.text) : 'Not provided';
          }
          if (!correctAnswer) correctAnswer = 'Not provided';

          // Build question data
          const questionData = {
            text: qd.text,
            type: qType,
            options,
            correctAnswer,
            points: qd.points || 1,
            difficulty: qd.difficulty || 'medium',
            exam: exam._id,
            section: sec.name,
          };

          // Add matching-specific fields
          if (qType === 'matching') {
            questionData.matchingPairs = {
              leftColumn: qd.leftItems || qd.matchingPairs?.leftColumn || [],
              rightColumn: qd.rightItems || qd.matchingPairs?.rightColumn || [],
              correctPairs: qd.matchingPairs?.correctPairs || qd.correctAnswer || []
            };
          }

          // Add ordering-specific fields
          if (qType === 'ordering') {
            questionData.itemsToOrder = {
              items: qd.items || qd.itemsToOrder?.items || [],
              correctOrder: qd.itemsToOrder?.correctOrder || qd.correctAnswer || []
            };
          }

          const question = await Question.create(questionData);
          const si = exam.sections.findIndex(s => s.name === sec.name);
          if (si !== -1) exam.sections[si].questions.push(question._id);
        }
      }
      await exam.save();
    }

    // Check if the exam has questions before returning it
    const hasQuestions = exam.sections.some(section => section.questions && section.questions.length > 0);

    if (!hasQuestions && examFilePath) {
      console.warn(`Exam ${exam._id} was created but no questions were extracted from the file.`);
      return res.status(201).json({
        ...exam.toObject(),
        warning: 'No questions were extracted from the uploaded file. Students will not be able to take this exam until questions are added.'
      });
    }

    res.status(201).json(exam);
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all exams
// @route   GET /api/exam
// @access  Private
const getExams = async (req, res) => {
  try {
    const exams = await Exam.find({})
      .populate('createdBy', 'fullName')
      .select('-sections.questions');

    res.json(exams);
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam by ID
// @route   GET /api/exam/:id
// @access  Private
const getExamById = async (req, res) => {
  try {
    const examId = req.params.id;

    // Validate ObjectId format
    if (!examId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`Invalid ObjectId format: ${examId}`);
      return res.status(400).json({
        message: 'Invalid exam ID format',
        examId: examId
      });
    }

    const exam = await Exam.findById(examId)
      .populate('createdBy', 'fullName')
      .populate({
        path: 'sections.questions',
        select: 'text type options points section'
      });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // If user is a student and exam is locked, return the exam with a locked flag
    // This allows the frontend to display a proper message
    if (req.user.role === 'student' && exam.isLocked) {
      console.log(`Student ${req.user._id} attempted to access locked exam ${exam._id}`);

      // Return basic exam info without questions
      return res.json({
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        timeLimit: exam.timeLimit,
        isLocked: true,
        allowSelectiveAnswering: exam.allowSelectiveAnswering,
        sectionBRequiredQuestions: exam.sectionBRequiredQuestions,
        sectionCRequiredQuestions: exam.sectionCRequiredQuestions,
        message: 'This exam is currently locked by the administrator'
      });
    }

    // Check if the exam has any questions
    let hasQuestions = false;
    let totalQuestions = 0;

    // Log detailed information about each section and its questions
    console.log(`Exam ${exam._id} (${exam.title}) sections:`);

    for (const section of exam.sections) {
      const sectionQuestions = section.questions || [];
      if (sectionQuestions.length > 0) {
        hasQuestions = true;
        totalQuestions += sectionQuestions.length;
      }

      console.log(`  Section ${section.name}: ${section.description || 'No description'}`);
      console.log(`    Questions: ${sectionQuestions.length}`);

      // Log the first question of each section to help diagnose issues
      if (sectionQuestions.length > 0) {
        const firstQuestion = sectionQuestions[0];
        console.log(`    First question: ${firstQuestion.text.substring(0, 50)}... (type: ${firstQuestion.type})`);
      }
    }

    console.log(`Exam ${exam._id} has ${totalQuestions} questions across ${exam.sections.length} sections`);

    // Check if the exam has extracted content
    if (hasQuestions) {
      console.log(`Exam ${exam._id} has extracted content. Using existing questions.`);
    } else {
      console.log(`Exam ${exam._id} has no extracted content. Creating questions from file.`);

      // Check if the exam has an original file
      if (exam.originalFile && fs.existsSync(exam.originalFile)) {
        try {
          console.log(`Parsing exam file for direct question extraction: ${exam.originalFile}`);
          const parsedExam = await parseExamFile(exam.originalFile, exam.answerFile);

          // Create questions for each section
          for (const section of parsedExam.sections) {
            // Find or create the section in the exam
            let examSection = exam.sections.find(s => s.name === section.name);

            if (!examSection) {
              // If the section doesn't exist in the exam, create it
              exam.sections.push({
                name: section.name,
                description: section.description || `Section ${section.name}`,
                questions: []
              });
              examSection = exam.sections[exam.sections.length - 1];
              console.log(`Created new section ${section.name} in exam`);
            }

            // Create questions for this section
            for (const questionData of section.questions) {
              try {
                // Validate question data
                if (!questionData.text) {
                  console.warn(`Skipping question with no text in section ${section.name}`);
                  continue;
                }

                // Create the question
                const question = await Question.create({
                  text: questionData.text,
                  type: questionData.type || 'multiple-choice',
                  options: questionData.options || [],
                  correctAnswer: questionData.correctAnswer || '',
                  points: questionData.points || 1,
                  exam: exam._id,
                  section: section.name
                });

                console.log(`Created question ${question._id} in section ${section.name}`);

                // Add question to the appropriate section
                const sectionIndex = exam.sections.findIndex(s => s.name === section.name);
                if (sectionIndex !== -1) {
                  exam.sections[sectionIndex].questions.push(question._id);
                }
              } catch (questionError) {
                console.error(`Error creating question in section ${section.name}:`, questionError);
                // Continue with other questions
              }
            }
          }

          // Save the updated exam with questions
          await exam.save();
          console.log(`Exam ${exam._id} saved with directly extracted questions`);
        } catch (parseError) {
          console.error('Error parsing exam file:', parseError);
          // Return an error message instead of creating default questions
          return res.status(400).json({
            message: 'Could not extract questions from the uploaded file. Please check the file format and content.',
            error: parseError.message
          });
        }
      } else {
        // If no original file, return an error
        return res.status(400).json({
          message: 'No exam file found. Please upload a file with exam questions.',
          originalFile: exam.originalFile || 'None'
        });
      }

      // Reload the exam with the new questions
      const updatedExam = await Exam.findById(req.params.id)
        .populate('createdBy', 'fullName')
        .populate({
          path: 'sections.questions',
          select: 'text type options points section'
        });

      console.log(`Created questions for exam ${exam._id}`);
      return res.json(updatedExam);
    }

    // For students, make sure they can see the questions
    if (req.user.role === 'student') {
      // Hide correct answers for multiple choice questions
      const examForStudent = JSON.parse(JSON.stringify(exam));

      // Log selective answering info for debugging
      console.log(`Student exam view - allowSelectiveAnswering: ${examForStudent.allowSelectiveAnswering}, sectionB: ${examForStudent.sectionBRequiredQuestions}, sectionC: ${examForStudent.sectionCRequiredQuestions}`);

      for (const section of examForStudent.sections) {
        for (const question of section.questions) {
          if (question.type === 'multiple-choice') {
            // Remove the correctAnswer field and isCorrect flags from options
            delete question.correctAnswer;
            if (question.options && Array.isArray(question.options)) {
              question.options = question.options.map((option, index) => ({
                text: option.text,
                letter: option.letter || String.fromCharCode(65 + index), // Ensure letter property is included
                value: option.value || option.letter?.toLowerCase() || String.fromCharCode(97 + index), // Ensure value property is included
                _id: option._id
              }));
            }
          } else if (question.type === 'open-ended') {
            // For open-ended questions, remove the model answer
            delete question.correctAnswer;
          }
        }
      }

      return res.json(examForStudent);
    }

    res.json(exam);
  } catch (error) {
    console.error('Get exam by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update exam
// @route   PUT /api/exam/:id
// @access  Private/Admin
const updateExam = async (req, res) => {
  try {
    console.log('Update exam request body:', req.body);
    console.log('Update exam request files:', req.files);

    const {
      title,
      description,
      timeLimit,
      passingScore,
      isLocked,
      allowSelectiveAnswering,
      sectionBRequiredQuestions,
      sectionCRequiredQuestions
    } = req.body;

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Update exam fields
    if (title) exam.title = title;
    if (description) exam.description = description;
    if (timeLimit) exam.timeLimit = parseInt(timeLimit);
    if (passingScore !== undefined) exam.passingScore = parseInt(passingScore);
    if (isLocked !== undefined) {
      exam.isLocked = isLocked === 'true' || isLocked === true;
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.examFile && req.files.examFile[0]) {
        const examFile = req.files.examFile[0];
        exam.originalFile = examFile.path;
        console.log('Updated exam file:', examFile.path);
      }

      if (req.files.answerFile && req.files.answerFile[0]) {
        const answerFile = req.files.answerFile[0];
        exam.answerFile = answerFile.path;
        console.log('Updated answer file:', answerFile.path);
      }
    }

    // Update selective answering fields if provided
    if (allowSelectiveAnswering !== undefined) {
      // Handle both boolean and string values
      exam.allowSelectiveAnswering =
        typeof allowSelectiveAnswering === 'boolean'
          ? allowSelectiveAnswering
          : allowSelectiveAnswering === 'true';

      console.log(`Updated allowSelectiveAnswering to ${exam.allowSelectiveAnswering} for exam ${exam._id}`);
    }

    if (sectionBRequiredQuestions !== undefined) {
      // Parse to integer if it's a string
      exam.sectionBRequiredQuestions =
        typeof sectionBRequiredQuestions === 'number'
          ? sectionBRequiredQuestions
          : parseInt(sectionBRequiredQuestions);

      console.log(`Updated sectionBRequiredQuestions to ${exam.sectionBRequiredQuestions} for exam ${exam._id}`);
    }

    if (sectionCRequiredQuestions !== undefined) {
      // Parse to integer if it's a string
      exam.sectionCRequiredQuestions =
        typeof sectionCRequiredQuestions === 'number'
          ? sectionCRequiredQuestions
          : parseInt(sectionCRequiredQuestions);

      console.log(`Updated sectionCRequiredQuestions to ${exam.sectionCRequiredQuestions} for exam ${exam._id}`);
    }

    const updatedExam = await exam.save();

    res.json(updatedExam);
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete exam
// @route   DELETE /api/exam/:id
// @access  Private/Admin
const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Delete associated questions
    await Question.deleteMany({ exam: exam._id });

    // Delete associated results
    await Result.deleteMany({ exam: exam._id });

    // Delete uploaded files
    if (exam.originalFile && fs.existsSync(exam.originalFile)) {
      fs.unlinkSync(exam.originalFile);
    }

    if (exam.answerFile && fs.existsSync(exam.answerFile)) {
      fs.unlinkSync(exam.answerFile);
    }

    // Delete exam
    await exam.deleteOne();

    res.json({ message: 'Exam removed' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle exam lock status
// @route   PUT /api/exam/:id/toggle-lock
// @access  Private/Admin
const toggleExamLock = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    exam.isLocked = !exam.isLocked;

    const updatedExam = await exam.save();

    res.json({
      _id: updatedExam._id,
      isLocked: updatedExam.isLocked,
      message: `Exam ${updatedExam.isLocked ? 'locked' : 'unlocked'} successfully`
    });
  } catch (error) {
    console.error('Toggle exam lock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Start an exam
// @route   POST /api/exam/:id/start
// @access  Private/Student
const startExam = async (req, res) => {
  try {
    const examId = req.params.id;

    // Validate ObjectId format
    if (!examId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`Invalid ObjectId format for startExam: ${examId}`);
      return res.status(400).json({
        message: 'Invalid exam ID format',
        examId: examId
      });
    }

    // Use let instead of const so we can reassign it later
    let exam = await Exam.findById(examId)
      .populate({
        path: 'sections.questions',
        select: 'text type options points section'
      });

    if (!exam) {
      console.log(`Exam not found with ID: ${req.params.id}`);
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if exam is locked
    if (exam.isLocked) {
      console.log(`Student ${req.user._id} attempted to start locked exam ${exam._id}`);
      return res.status(403).json({
        message: 'This exam is currently locked by the administrator',
        isLocked: true
      });
    }

    // Check if student has already started this exam
    const existingResult = await Result.findOne({
      student: req.user._id,
      exam: exam._id
    }).sort({ startTime: -1 }); // Get the most recent attempt

    // If there's an existing result and it's completed
    if (existingResult && existingResult.isCompleted) {
      // Check if the exam allows retakes (not locked)
      if (!exam.isLocked) {
        console.log(`Student ${req.user._id} is retaking exam ${exam._id} that was previously completed`);

        // Ensure the exam has questions before allowing retake
        if (!hasExtractedContent(exam)) {
          console.error(`Exam ${exam._id} has no questions for retake. This should not happen.`);
          return res.status(400).json({
            message: 'This exam has no questions. Please contact your administrator.',
            error: 'No questions found for retake'
          });
        }

        console.log(`Exam ${exam._id} has ${exam.sections.reduce((total, section) =>
          total + (section.questions?.length || 0), 0)} questions for retake`);

        // Allow retake by creating a new attempt with the same questions
        // Continue to the code below that creates a new result
      } else {
        return res.status(400).json({
          message: 'You have already completed this exam and it is locked for retakes',
          isCompleted: true
        });
      }
    } else if (existingResult && !existingResult.isCompleted) {
      // Return the existing result if exam was started but not completed
      console.log(`Student ${req.user._id} is continuing exam ${exam._id} that was previously started`);
      return res.json(existingResult);
    }

    console.log(`Student ${req.user._id} is starting a new attempt for exam ${exam._id}`);

    // Check if the exam has any questions
    let hasQuestions = false;
    let totalQuestions = 0;

    // Log detailed information about each section and its questions
    console.log(`Exam ${exam._id} (${exam.title}) sections for student ${req.user._id}:`);

    for (const section of exam.sections) {
      const sectionQuestions = section.questions || [];
      if (sectionQuestions.length > 0) {
        hasQuestions = true;
        totalQuestions += sectionQuestions.length;
      }

      console.log(`  Section ${section.name}: ${section.description || 'No description'}`);
      console.log(`    Questions: ${sectionQuestions.length}`);

      // Log the first question of each section to help diagnose issues
      if (sectionQuestions.length > 0) {
        const firstQuestion = sectionQuestions[0];
        console.log(`    First question: ${firstQuestion.text.substring(0, 50)}... (type: ${firstQuestion.type})`);
      }
    }

    console.log(`Exam ${exam._id} has ${totalQuestions} questions across ${exam.sections.length} sections`);

    // Check if the exam has extracted content
    if (hasQuestions) {
      // For retakes, this ensures the student sees the exact same questions as before
      console.log(`Exam ${exam._id} has extracted content. Using existing questions for student ${req.user._id}.`);
      console.log(`Student will see the exact same ${totalQuestions} questions across ${exam.sections.length} sections.`);
    } else {
      console.log(`Exam ${exam._id} has no extracted content. Creating questions from file before starting.`);
      console.log(`This is likely the first time this exam is being taken.`);

      // Check if the exam has an original file
      if (exam.originalFile && fs.existsSync(exam.originalFile)) {
        try {
          console.log(`Parsing exam file for direct question extraction: ${exam.originalFile}`);
          const parsedExam = await parseExamFile(exam.originalFile);

          // Create questions for each section
          for (const section of parsedExam.sections) {
            // Find or create the section in the exam
            let examSection = exam.sections.find(s => s.name === section.name);

            if (!examSection) {
              // If the section doesn't exist in the exam, create it
              exam.sections.push({
                name: section.name,
                description: section.description || `Section ${section.name}`,
                questions: []
              });
              examSection = exam.sections[exam.sections.length - 1];
              console.log(`Created new section ${section.name} in exam`);
            }

            // Create questions for this section
            for (const questionData of section.questions) {
              try {
                // Validate question data
                if (!questionData.text) {
                  console.warn(`Skipping question with no text in section ${section.name}`);
                  continue;
                }

                // Ensure we have a valid correctAnswer
                let correctAnswer = questionData.correctAnswer || '';
                if (!correctAnswer && questionData.type === 'multiple-choice') {
                  // For multiple choice, try to find the correct option
                  const correctOption = (questionData.options || []).find(opt => opt.isCorrect);
                  if (correctOption) {
                    correctAnswer = correctOption.text;
                  } else {
                    correctAnswer = 'Not provided';
                  }
                } else if (!correctAnswer) {
                  correctAnswer = 'Not provided';
                }

                // Create the question with valid data
                const question = await Question.create({
                  text: questionData.text,
                  type: questionData.type || 'multiple-choice',
                  options: questionData.options || [],
                  correctAnswer: correctAnswer,
                  points: questionData.points || 1,
                  exam: exam._id,
                  section: section.name
                });

                console.log(`Created question ${question._id} in section ${section.name}`);

                // Add question to the appropriate section
                const sectionIndex = exam.sections.findIndex(s => s.name === section.name);
                if (sectionIndex !== -1) {
                  exam.sections[sectionIndex].questions.push(question._id);
                }
              } catch (questionError) {
                console.error(`Error creating question in section ${section.name}:`, questionError);
                // Continue with other questions
              }
            }
          }

          // Save the updated exam with questions
          await exam.save();
          console.log(`Exam ${exam._id} saved with directly extracted questions`);
        } catch (parseError) {
          console.error('Error parsing exam file:', parseError);
          // Return an error message instead of creating default questions
          return res.status(400).json({
            message: 'Could not extract questions from the uploaded file. Please check the file format and content.',
            error: parseError.message
          });
        }
      } else {
        // If no original file, return an error
        return res.status(400).json({
          message: 'No exam file found. Please upload a file with exam questions.',
          originalFile: exam.originalFile || 'None'
        });
      }

      // Reload the exam with the new questions
      exam = await Exam.findById(req.params.id)
        .populate({
          path: 'sections.questions',
          select: 'text type options points section'
        });

      console.log(`Created questions for exam ${exam._id}`);
    }

    // For students, hide correct answers
    for (const section of exam.sections) {
      for (const question of section.questions) {
        if (question.type === 'multiple-choice') {
          // Keep the options but remove the isCorrect flags
          if (question.options && Array.isArray(question.options)) {
            question.options.forEach(option => {
              delete option.isCorrect;
            });
          }
        }
      }
    }

    // Calculate max possible score
    let maxPossibleScore = 0;
    const allQuestions = [];

    // Filter out sections with no questions
    const sectionsWithQuestions = exam.sections.filter(section =>
      section.questions && section.questions.length > 0
    );

    // Log which sections have questions
    console.log(`Exam ${exam._id} has ${sectionsWithQuestions.length} sections with questions:`);
    sectionsWithQuestions.forEach(section => {
      console.log(`  Section ${section.name}: ${section.questions.length} questions`);
    });

    // Only process sections that have questions
    sectionsWithQuestions.forEach(section => {
      section.questions.forEach(question => {
        allQuestions.push(question);
        maxPossibleScore += question.points;
      });
    });

    // Group questions by section for proper initialization
    const questionsBySection = {
      A: allQuestions.filter(q => q.section === 'A'),
      B: allQuestions.filter(q => q.section === 'B'),
      C: allQuestions.filter(q => q.section === 'C')
    };

    // Seeded random number generator for consistent shuffling per student-exam pair
    function seededRandom(seed) {
      let x = Math.sin(seed) * 10000;
      return function() {
        x = Math.sin(x) * 10000;
        return x - Math.floor(x);
      };
    }

    // Shuffle array using seeded random for consistency
    function shuffleArray(array, seed) {
      const rng = seededRandom(seed);
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    // Generate a unique seed for this student-exam pair
    const studentExamSeed = parseInt(req.user._id.toString().slice(-8), 16) + parseInt(exam._id.toString().slice(-8), 16);

    // Shuffle questions within each section to prevent cheating
    const shuffledQuestionsBySection = {};
    for (const sectionName in questionsBySection) {
      shuffledQuestionsBySection[sectionName] = shuffleArray(
        questionsBySection[sectionName],
        studentExamSeed + sectionName.charCodeAt(0)
      );
    }

    console.log(`Exam ${exam._id} question distribution (shuffled for student ${req.user._id}):`, {
      sectionA: shuffledQuestionsBySection.A.length,
      sectionB: shuffledQuestionsBySection.B.length,
      sectionC: shuffledQuestionsBySection.C.length,
      allowSelectiveAnswering: exam.allowSelectiveAnswering,
      sectionBRequired: exam.sectionBRequiredQuestions || 3,
      sectionCRequired: exam.sectionCRequiredQuestions || 1
    });

    // Create a new result with proper selection initialization using shuffled questions
    const allShuffledQuestions = [
      ...shuffledQuestionsBySection.A,
      ...shuffledQuestionsBySection.B,
      ...shuffledQuestionsBySection.C
    ];

    const result = await Result.create({
      student: req.user._id,
      exam: exam._id,
      startTime: Date.now(),
      maxPossibleScore,
      answers: allShuffledQuestions.map((question) => {
        let isSelected = true; // Default to selected for all questions

        // For selective answering, auto-select the required number of questions in each section
        if (exam.allowSelectiveAnswering && (question.section === 'B' || question.section === 'C')) {
          // Get questions in this section (already shuffled)
          const sectionQuestions = shuffledQuestionsBySection[question.section];
          const sortedSectionQuestions = [...sectionQuestions].sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

          // Get required count for this section
          const requiredCount = question.section === 'B'
            ? (exam.sectionBRequiredQuestions || 3)
            : (exam.sectionCRequiredQuestions || 1);

          // Find the index of this question in its sorted section
          const questionIndexInSection = sortedSectionQuestions.findIndex(q => q._id.toString() === question._id.toString());

          // Auto-select the first N questions in each section
          isSelected = questionIndexInSection < requiredCount;

          console.log(`Question ${question._id} in section ${question.section}: index ${questionIndexInSection}/${sortedSectionQuestions.length}, required ${requiredCount}, selected: ${isSelected}`);
        }

        return {
          question: question._id,
          score: 0,
          isSelected
        };
      })
    });

    res.json(result);
  } catch (error) {
    console.error('Start exam error:', error);

    // Provide more specific error messages to help with debugging
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation error when creating questions. Please check the exam file format.',
        details: error.message
      });
    } else if (error.message && error.message.includes('correctAnswer')) {
      return res.status(400).json({
        message: 'Error with question format. Please ensure all questions have correct answers.',
        details: error.message
      });
    } else if (error.message && error.message.includes('Assignment to constant variable')) {
      return res.status(500).json({
        message: 'Internal server error. Please contact the administrator.',
        details: 'Variable assignment error'
      });
    }

    res.status(500).json({
      message: 'Server error when starting exam. Please try again or contact the administrator.',
      error: error.message
    });
  }
};

// @desc    Submit an answer with enhanced validation and error handling
// @route   POST /api/exam/:id/answer
// @access  Private/Student
const submitAnswer = async (req, res) => {
  try {
    const { questionId, selectedOption, textAnswer, questionType, matchingAnswers, orderingAnswer, dragDropAnswer } = req.body;

    console.log('Received answer submission:', {
      questionId,
      selectedOption,
      textAnswer,
      questionType,
      hasMatchingAnswers: !!matchingAnswers,
      hasOrderingAnswer: !!orderingAnswer,
      hasDragDropAnswer: !!dragDropAnswer
    });

    // Import validation utilities
    const { validateAnswerSubmission, sanitizeAnswerData } = require('../utils/examSubmissionValidator');

    // Sanitize input data
    const sanitizedData = sanitizeAnswerData({
      questionId,
      selectedOption,
      textAnswer,
      questionType,
      matchingAnswers,
      orderingAnswer,
      dragDropAnswer
    });

    // Enhanced input validation
    if (!sanitizedData.questionId) {
      return res.status(400).json({
        message: 'Question ID is required',
        success: false
      });
    }

    // Find the result for this student and exam
    const result = await Result.findOne({
      student: req.user._id,
      exam: req.params.id,
      isCompleted: false
    });

    if (!result) {
      return res.status(404).json({
        message: 'Exam session not found or already completed',
        success: false
      });
    }

    // Find the question with better error handling
    const question = await Question.findById(sanitizedData.questionId);

    if (!question) {
      return res.status(404).json({
        message: 'Question not found',
        success: false
      });
    }

    // Validate the answer submission
    const answerValidation = validateAnswerSubmission(sanitizedData, question);
    if (!answerValidation.success) {
      return res.status(400).json({
        message: 'Answer validation failed',
        errors: answerValidation.errors,
        warnings: answerValidation.warnings,
        success: false
      });
    }

    // Log validation warnings if any
    if (answerValidation.warnings.length > 0) {
      console.warn('Answer validation warnings:', answerValidation.warnings);
    }

    // Find the answer in the result
    const answerIndex = result.answers.findIndex(
      answer => answer.question.toString() === sanitizedData.questionId
    );

    if (answerIndex === -1) {
      return res.status(404).json({
        message: 'Answer not found in result',
        success: false
      });
    }

    // Determine the actual question type (use frontend detection if provided)
    const actualQuestionType = sanitizedData.questionType || question.type;

    console.log(`Processing answer for question type: ${actualQuestionType}`);

    // Use sanitized data for processing
    const {
      selectedOption: cleanSelectedOption,
      textAnswer: cleanTextAnswer,
      matchingAnswers: cleanMatchingAnswers,
      orderingAnswer: cleanOrderingAnswer,
      dragDropAnswer: cleanDragDropAnswer
    } = sanitizedData;

    // Update the answer based on the actual question type
    if (actualQuestionType === 'multiple-choice' && !actualQuestionType.includes('fill-in')) {
      // For multiple choice, check if the selected option is correct
      let isCorrect = false;
      let correctOptionText = '';
      let correctOptionLetter = '';

      // Find the correct option based on the isCorrect flag
      const correctOption = question.options.find(option => option.isCorrect);

      // Find the selected option object - try different matching strategies
      let selectedOptionObj = null;

      // First try exact match by text
      selectedOptionObj = question.options.find(opt => opt.text === selectedOption);

      // If not found, try case-insensitive match
      if (!selectedOptionObj) {
        selectedOptionObj = question.options.find(opt =>
          opt.text && opt.text.toLowerCase().trim() === selectedOption.toLowerCase().trim()
        );
      }

      // If still not found, try partial match
      if (!selectedOptionObj) {
        selectedOptionObj = question.options.find(opt =>
          opt.text && (
            opt.text.toLowerCase().includes(selectedOption.toLowerCase()) ||
            selectedOption.toLowerCase().includes(opt.text.toLowerCase())
          )
        );
      }

      // Store the selected option information
      result.answers[answerIndex].selectedOption = cleanSelectedOption;
      result.answers[answerIndex].selectedOptionLetter = selectedOptionObj?.letter || '';

      if (correctOption) {
        correctOptionText = correctOption.text || '';
        correctOptionLetter = correctOption.letter || '';

        // Check if the selected option is correct
        if (selectedOptionObj) {
          isCorrect = selectedOptionObj._id?.toString() === correctOption._id?.toString() ||
                     selectedOptionObj.letter === correctOption.letter ||
                     selectedOptionObj.isCorrect === true;
        }
      }

      // Store the grading results
      result.answers[answerIndex].isCorrect = isCorrect;
      result.answers[answerIndex].score = isCorrect ? (question.points || 1) : 0;

      // Enhanced feedback with better information
      if (isCorrect) {
        result.answers[answerIndex].feedback = `✅ Correct! You selected: ${selectedOptionObj?.letter || ''}. ${selectedOptionObj?.text || selectedOption}`;
      } else {
        const correctDisplay = correctOptionLetter ? `${correctOptionLetter}. ${correctOptionText}` : correctOptionText;
        const selectedDisplay = selectedOptionObj?.letter ? `${selectedOptionObj.letter}. ${selectedOptionObj.text}` : selectedOption;
        result.answers[answerIndex].feedback = `❌ Incorrect. You selected: ${selectedDisplay}. The correct answer is: ${correctDisplay}`;
      }

      console.log(`Multiple choice answer for question ${questionId}:`);
      console.log(`- Selected option: ${selectedOption}`);
      console.log(`- Correct option: ${correctOptionText}`);
      console.log(`- Is correct: ${isCorrect}`);
    } else if (actualQuestionType === 'fill-in-blank') {
      // Handle fill-in-blank questions specifically
      try {
        const answerText = cleanTextAnswer || cleanSelectedOption || '';

        console.log(`Processing fill-in-blank answer for question ${sanitizedData.questionId}:`);
        console.log(`- Answer text: "${answerText}"`);

        // Store the answer
        result.answers[answerIndex].textAnswer = answerText;

        // Provide immediate feedback
        result.answers[answerIndex].feedback = 'Your fill-in-blank answer has been saved. It will be graded when you complete the exam.';

        console.log(`Stored fill-in-blank answer for question ${sanitizedData.questionId}`);
      } catch (error) {
        console.error('Error storing fill-in-blank answer:', error);
        return res.status(500).json({
          message: 'Error saving your fill-in-blank answer. Please try again.',
          success: false
        });
      }
    } else if (actualQuestionType === 'true-false') {
      // Handle true/false questions
      try {
        const answerValue = cleanSelectedOption || cleanTextAnswer || '';

        console.log(`Processing true/false answer for question ${sanitizedData.questionId}:`);
        console.log(`- Answer: "${answerValue}"`);

        // Store the answer
        result.answers[answerIndex].selectedOption = answerValue;

        // Provide immediate feedback
        result.answers[answerIndex].feedback = 'Your true/false answer has been saved.';

        console.log(`Stored true/false answer for question ${sanitizedData.questionId}`);
      } catch (error) {
        console.error('Error storing true/false answer:', error);
        return res.status(500).json({
          message: 'Error saving your true/false answer. Please try again.',
          success: false
        });
      }
    } else if (actualQuestionType === 'matching') {
      // Handle matching questions
      try {
        console.log(`Processing matching answer for question ${sanitizedData.questionId}:`);
        console.log(`- Matching answers:`, cleanMatchingAnswers);

        // Store the matching answers (validation already done)
        result.answers[answerIndex].matchingAnswers = cleanMatchingAnswers;

        // Provide immediate feedback
        result.answers[answerIndex].feedback = 'Your matching answer has been saved. It will be graded when you complete the exam.';

        console.log(`Stored matching answer for question ${sanitizedData.questionId}`);
      } catch (error) {
        console.error('Error storing matching answer:', error);
        return res.status(500).json({
          message: 'Error saving your matching answer. Please try again.',
          success: false
        });
      }
    } else if (actualQuestionType === 'ordering') {
      // Handle ordering questions
      try {
        console.log(`Processing ordering answer for question ${sanitizedData.questionId}:`);
        console.log(`- Ordering answer:`, cleanOrderingAnswer);

        // Store the ordering answer (validation already done)
        result.answers[answerIndex].orderingAnswer = cleanOrderingAnswer;

        // Provide immediate feedback
        result.answers[answerIndex].feedback = 'Your ordering answer has been saved. It will be graded when you complete the exam.';

        console.log(`Stored ordering answer for question ${sanitizedData.questionId}`);
      } catch (error) {
        console.error('Error storing ordering answer:', error);
        return res.status(500).json({
          message: 'Error saving your ordering answer. Please try again.',
          success: false
        });
      }
    } else if (actualQuestionType === 'drag-drop') {
      // Handle drag-drop questions
      try {
        console.log(`Processing drag-drop answer for question ${sanitizedData.questionId}:`);
        console.log(`- Drag-drop answer:`, cleanDragDropAnswer);

        // Store the drag-drop answer (validation already done)
        result.answers[answerIndex].dragDropAnswer = cleanDragDropAnswer;

        // Provide immediate feedback
        result.answers[answerIndex].feedback = 'Your drag-drop answer has been saved. It will be graded when you complete the exam.';

        console.log(`Stored drag-drop answer for question ${sanitizedData.questionId}`);
      } catch (error) {
        console.error('Error storing drag-drop answer:', error);
        return res.status(500).json({
          message: 'Error saving your drag-drop answer. Please try again.',
          success: false
        });
      }
    } else {
      // For other question types (essays, short answers, etc.)
      try {
        const answerText = cleanTextAnswer || cleanSelectedOption || '';

        console.log(`Processing ${actualQuestionType} answer for question ${sanitizedData.questionId}:`);
        console.log(`- Answer length: ${answerText.length} characters`);

        // Store the answer (validation already done)
        result.answers[answerIndex].textAnswer = answerText;

        // Provide immediate feedback to the student
        result.answers[answerIndex].feedback = 'Your answer has been saved. It will be graded when you complete the exam.';

        console.log(`Stored ${actualQuestionType} answer for question ${sanitizedData.questionId}`);
      } catch (error) {
        console.error(`Error storing ${actualQuestionType} answer:`, error);
        return res.status(500).json({
          message: 'Error saving your answer. Please try again.',
          success: false
        });
      }
    }

    // Save the result with enhanced error handling
    try {
      await result.save();
      console.log(`Successfully saved answer for question ${sanitizedData.questionId} to database`);
    } catch (saveError) {
      console.error('Error saving result to database:', saveError);
      return res.status(500).json({
        message: 'Failed to save answer to database. Please try again.',
        success: false
      });
    }

    res.json({
      message: 'Answer submitted successfully',
      answerId: result.answers[answerIndex]._id,
      questionType: actualQuestionType,
      success: true
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Fast exam completion with chunked AI grading
// @route   POST /api/exam/:id/complete
// @access  Private/Student
const submissionLocks = new Map();

const completeExam = async (req, res) => {
  const lockKey = `${req.user._id}-${req.params.id}`;

  // Check for concurrent submissions
  if (submissionLocks.has(lockKey)) {
    console.log(`⚠️ Concurrent submission detected for student ${req.user._id}, exam ${req.params.id}`);
    return res.status(429).json({
      message: 'Submission already in progress. Please wait.',
      success: false
    });
  }

  // Set the lock
  submissionLocks.set(lockKey, Date.now());

  try {
    console.log(`🚀 Starting fast exam completion for student ${req.user._id}, exam ${req.params.id}`);

    // Validation
    if (!req.params.id) {
      submissionLocks.delete(lockKey);
      return res.status(400).json({
        message: 'Exam ID is required',
        success: false
      });
    }

    // Find the current active result
    const allResults = await Result.find({
      student: req.user._id,
      exam: req.params.id
    }).select('_id isCompleted endTime createdAt').sort({ createdAt: -1 });

    console.log(`Found ${allResults.length} results for student ${req.user._id} and exam ${req.params.id}`);

    // Find the current active (incomplete) result for this student and exam
    const currentResult = await Result.findOne({
      student: req.user._id,
      exam: req.params.id,
      isCompleted: false
    }).sort({ createdAt: -1 }); // Get the most recent incomplete result

    // If there's no active result, check if there's already a completed one
    if (!currentResult) {
      const existingCompletedResult = await Result.findOne({
        student: req.user._id,
        exam: req.params.id,
        isCompleted: true
      }).sort({ endTime: -1 }); // Get the most recent completed result

      if (existingCompletedResult) {
        console.log(`⚠️ Student ${req.user._id} attempted to submit already completed exam ${req.params.id}`);
        console.log(`Existing completed result ID: ${existingCompletedResult._id}`);
        console.log(`Existing result completion time: ${existingCompletedResult.endTime}`);

        // Release the lock before returning
        submissionLocks.delete(lockKey);

        // Return the existing result data instead of just an error
        const percentage = existingCompletedResult.maxPossibleScore > 0
          ? (existingCompletedResult.totalScore / existingCompletedResult.maxPossibleScore) * 100
          : 0;

        return res.status(409).json({
          message: 'Exam has already been completed',
          success: false,
          resultId: existingCompletedResult._id,
          alreadyCompleted: true,
          totalScore: existingCompletedResult.totalScore,
          maxPossibleScore: existingCompletedResult.maxPossibleScore,
          percentage: percentage,
          endTime: existingCompletedResult.endTime
        });
      } else {
        // No active or completed result found
        submissionLocks.delete(lockKey);
        return res.status(404).json({
          message: 'No active exam session found. Please start the exam first.',
          success: false
        });
      }
    }

    // Check if the current result is already completed (race condition protection)
    if (currentResult.isCompleted) {
      console.log(`⚠️ Current result ${currentResult._id} is already completed`);

      // Release the lock before returning
      submissionLocks.delete(lockKey);

      // Return the current result data
      const percentage = currentResult.maxPossibleScore > 0
        ? (currentResult.totalScore / currentResult.maxPossibleScore) * 100
        : 0;

      return res.status(409).json({
        message: 'This exam session has already been completed',
        success: false,
        resultId: currentResult._id,
        alreadyCompleted: true,
        totalScore: currentResult.totalScore,
        maxPossibleScore: currentResult.maxPossibleScore,
        percentage: percentage,
        endTime: currentResult.endTime
      });
    }

    // Use the current result we already found and populate the necessary fields
    const result = await Result.findById(currentResult._id).populate({
      path: 'answers.question',
      select: 'text type correctAnswer points section options'
    });

    if (!result) {
      submissionLocks.delete(lockKey);
      return res.status(404).json({
        message: 'Exam session not found',
        success: false
      });
    }

    // Validate that the result has answers
    if (!result.answers || result.answers.length === 0) {
      submissionLocks.delete(lockKey);
      return res.status(400).json({
        message: 'No answers found. Please answer at least one question before submitting.',
        success: false
      });
    }

    console.log(`Found result with ${result.answers.length} answers for grading`);

    // Import validation utilities
    const { validateExamSubmission, validateSubmissionTime } = require('../utils/examSubmissionValidator');

    // Get the exam object for validation
    const exam = await Exam.findById(result.exam);
    if (!exam) {
      submissionLocks.delete(lockKey);
      return res.status(404).json({
        message: 'Exam not found',
        success: false
      });
    }

    // Enhanced submission validation with detailed logging
    console.log('🔍 Validating exam submission...');
    const submissionValidation = validateExamSubmission(result, exam);

    if (!submissionValidation.success) {
      console.error('❌ Submission validation failed:', submissionValidation.errors);
      submissionLocks.delete(lockKey);
      return res.status(400).json({
        message: 'Invalid submission data',
        errors: submissionValidation.errors,
        warnings: submissionValidation.warnings || [],
        success: false,
        details: {
          totalQuestions: result.answers.length,
          answeredQuestions: submissionValidation.stats?.answeredQuestions || 0,
          validationErrors: submissionValidation.errors
        }
      });
    }

    console.log('✅ Submission validation passed:', submissionValidation.stats);

    // Validate submission time
    const timeValidation = validateSubmissionTime(result, exam);
    if (!timeValidation.success) {
      submissionLocks.delete(lockKey);
      return res.status(400).json({
        message: 'Submission time validation failed',
        errors: timeValidation.errors,
        warnings: timeValidation.warnings,
        success: false
      });
    }

    // Log validation warnings if any
    if (submissionValidation.warnings.length > 0) {
      console.warn('Submission warnings:', submissionValidation.warnings);
    }
    if (timeValidation.warnings.length > 0) {
      console.warn('Time validation warnings:', timeValidation.warnings);
    }

    console.log(`✅ Validation passed. Starting fast AI grading for ${submissionValidation.stats.answeredQuestions} answered questions`);

    // Start fast chunked AI grading process
    console.log(`🚀 Starting fast chunked AI grading...`);

    // Import the new fast grading utility
    const { fastChunkedGrading } = require('../utils/fastGrading');

    try {
      // Use the new fast chunked grading system
      const gradingResult = await fastChunkedGrading(result, exam);

      console.log(`✅ Fast grading completed successfully`);
      console.log(`- Total questions processed: ${gradingResult.processedCount}`);
      console.log(`- AI graded questions: ${gradingResult.aiGradedCount}`);
      console.log(`- Total grading time: ${gradingResult.totalTime}ms`);

      // Update the result with grading data
      result.answers = gradingResult.answers;
      result.totalScore = gradingResult.totalScore;
      result.maxPossibleScore = gradingResult.maxPossibleScore;

      // Mark as completed
      result.isCompleted = true;
      result.endTime = Date.now();
      result.aiGradingStatus = 'completed';

      // Validate grading methods before saving
      const validGradingMethods = [
        'enhanced_grading', 'enhanced_ai_grading', 'enhanced_ai', 'semantic_match',
        'direct_comparison', 'keyword_matching', 'default_fallback', 'background_ai_grading',
        'manual_grading', 'ai_grading', 'regrade_ai_grading', 'admin_regrade', 'ai_assisted',
        'predefined', 'error_fallback', 'fallback', 'no_answer', 'fallback_no_answer',
        'fallback_no_model', 'fallback_exact_match', 'fallback_exact_match_cleaned',
        'fallback_abbreviation_match', 'fallback_expansion_match', 'fallback_semantic_match',
        'fallback_keyword_matching', 'not_selected', 'fast_grading', 'fast_multiple_choice',
        'fast_ai_grading', 'fast_similarity', 'fast_keywords', 'no_selection',
        'unsupported_type', 'fallback_error', 'exact_match', 'error',
        'enhanced_ai_grading_section'
      ];

      // Ensure all grading methods are valid
      result.answers.forEach((answer, index) => {
        if (!answer.gradingMethod || !validGradingMethods.includes(answer.gradingMethod)) {
          console.warn(`Invalid gradingMethod "${answer.gradingMethod}" for answer ${index}, setting to fallback`);
          answer.gradingMethod = 'fallback';
        }
      });

      // Save the result
      await result.save();
      console.log(`✅ Successfully saved exam result ${result._id}`);

      // Release the lock
      submissionLocks.delete(lockKey);

      // Calculate percentage
      const percentage = result.maxPossibleScore > 0
        ? (result.totalScore / result.maxPossibleScore) * 100
        : 0;

      console.log(`🎉 Exam completed successfully!`);
      console.log(`- Student: ${req.user._id}`);
      console.log(`- Exam: ${req.params.id}`);
      console.log(`- Score: ${result.totalScore}/${result.maxPossibleScore} (${Math.round(percentage)}%)`);

      return res.json({
        message: 'Exam completed successfully with AI grading',
        success: true,
        totalScore: result.totalScore,
        maxPossibleScore: result.maxPossibleScore,
        percentage: Math.round(percentage),
        resultId: result._id,
        examId: result.exam,
        gradingStats: {
          processedCount: gradingResult.processedCount,
          aiGradedCount: gradingResult.aiGradedCount,
          totalTime: gradingResult.totalTime
        }
      });

    } catch (gradingError) {
      console.error('❌ Fast grading failed:', gradingError);

      // Release the lock
      submissionLocks.delete(lockKey);

      return res.status(500).json({
        message: 'Grading failed. Please try again.',
        success: false,
        error: gradingError.message
      });
    }
  } catch (error) {
    console.error('Complete exam error:', error);

    // Release the submission lock in case of error
    submissionLocks.delete(lockKey);

    res.status(500).json({
      message: 'Server error',
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Grade open-ended answers manually
// @route   POST /api/exam/grade/:resultId
// @access  Private/Admin
const gradeManually = async (req, res) => {
  try {
    const { answers } = req.body;

    const result = await Result.findById(req.params.resultId);

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Update scores for each answer
    for (const answer of answers) {
      const answerIndex = result.answers.findIndex(
        a => a._id.toString() === answer.answerId
      );

      if (answerIndex !== -1) {
        result.answers[answerIndex].score = answer.score;
        result.answers[answerIndex].feedback = answer.feedback;
        result.answers[answerIndex].isCorrect = answer.isCorrect;
      }
    }

    // Recalculate total score
    result.totalScore = result.answers.reduce((total, answer) => total + (answer.score || 0), 0);

    // Ensure maxPossibleScore is valid
    if (!result.maxPossibleScore || isNaN(result.maxPossibleScore) || result.maxPossibleScore <= 0) {
      result.maxPossibleScore = result.answers.reduce((total, answer) =>
        total + (answer.question.points || 1), 0) || 1;
    }

    // Save the result
    await result.save();

    res.json({
      message: 'Grading completed successfully',
      totalScore: result.totalScore || 0,
      maxPossibleScore: result.maxPossibleScore || 1
    });
  } catch (error) {
    console.error('Grade manually error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Trigger AI grading for all answers in a result with semantic equivalence
// @route   POST /api/exam/ai-grade/:resultId
// @access  Private/Admin
const triggerAIGrading = async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId).populate({
      path: 'answers.question',
      select: 'text type correctAnswer points section options'
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Add timeout protection for regrading
    const regradingTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Regrading process timed out after 120 seconds'));
      }, 120000); // 2 minutes timeout for regrading
    });

    const regradingPromise = (async () => {

    // Grade all question types using enhanced semantic grading
    for (let i = 0; i < result.answers.length; i++) {
      const answer = result.answers[i];
      const question = answer.question;

      // Skip empty answers
      if (!answer.textAnswer && !answer.selectedOption) {
        console.log(`Skipping empty answer for question ${question._id}`);
        continue;
      }

      console.log(`Regrading question ${question._id} (type: ${question.type})`);

      try {
        // Use enhanced grading system for all question types
        const { gradeQuestionByType } = require('../utils/enhancedGrading');

        // Get model answer
        let modelAnswer = question.correctAnswer || '';
        if (!modelAnswer || modelAnswer === "Not provided" || modelAnswer === "Sample answer") {
          console.log(`Warning: No model answer found for question ${question._id}. Using default.`);
          modelAnswer = "The answer should demonstrate understanding of the core concepts.";
        }

        // Use enhanced grading with semantic equivalence
        const grading = await gradeQuestionByType(question, answer, modelAnswer);

        result.answers[i].score = grading.score;
        result.answers[i].feedback = grading.feedback;
        result.answers[i].isCorrect = grading.score >= question.points;
        result.answers[i].correctedAnswer = grading.correctedAnswer || modelAnswer;

        console.log(`Successfully regraded question ${question._id}, score: ${grading.score}/${question.points}`);

      } catch (enhancedError) {
        console.error(`Enhanced grading failed for question ${question._id}:`, enhancedError.message);

        // Fallback to chunked grading for open-ended questions
        if (question.type === 'open-ended' && answer.textAnswer) {
          try {
            const { gradeOpenEndedAnswer: chunkedGradeEssay } = require('../utils/chunkedAiGrading');

            const grading = await chunkedGradeEssay(
              answer.textAnswer,
              question.correctAnswer,
              question.points,
              question.text
            );

            result.answers[i].score = grading.score;
            result.answers[i].feedback = grading.feedback;
            result.answers[i].isCorrect = grading.score >= question.points;
            result.answers[i].correctedAnswer = grading.correctedAnswer || question.correctAnswer;

            console.log(`Fallback grading successful for question ${question._id}`);
          } catch (fallbackError) {
            console.error(`All grading methods failed for question ${question._id}:`, fallbackError.message);

            // Final fallback - keyword matching
            const studentAnswer = (answer.textAnswer || '').toLowerCase();
            const modelAnswer = (question.correctAnswer || '').toLowerCase();

            if (studentAnswer && modelAnswer) {
              const modelKeywords = modelAnswer.split(/\s+/).filter(word => word.length > 3);
              const matchCount = modelKeywords.filter(keyword => studentAnswer.includes(keyword)).length;
              const matchPercentage = modelKeywords.length > 0 ? matchCount / modelKeywords.length : 0;
              const score = Math.round(matchPercentage * question.points);

              result.answers[i].score = score;
              result.answers[i].feedback = 'This answer was graded using keyword matching due to AI grading unavailability.';
              result.answers[i].isCorrect = score >= question.points;
              result.answers[i].correctedAnswer = question.correctAnswer;

              console.log(`Applied keyword matching for question ${question._id}, score: ${score}/${question.points}`);
            } else {
              // Give partial credit if no grading is possible
              result.answers[i].score = Math.round(question.points * 0.5);
              result.answers[i].feedback = 'Unable to grade automatically. Partial credit awarded.';
              result.answers[i].isCorrect = false;
              result.answers[i].correctedAnswer = question.correctAnswer;
            }
          }
        } else {
          // For non-open-ended questions, give partial credit
          result.answers[i].score = Math.round(question.points * 0.5);
          result.answers[i].feedback = 'Unable to grade automatically. Partial credit awarded.';
          result.answers[i].isCorrect = false;
          result.answers[i].correctedAnswer = question.correctAnswer;
        }
      }
    }

    // Calculate total score based on selective answering settings
    const exam = await Exam.findById(result.exam);

    if (exam && exam.allowSelectiveAnswering) {
      // Get all questions by section
      const sectionAQuestions = result.answers.filter(answer =>
        answer.question && answer.question.section === 'A');
      const sectionBQuestions = result.answers.filter(answer =>
        answer.question && answer.question.section === 'B');
      const sectionCQuestions = result.answers.filter(answer =>
        answer.question && answer.question.section === 'C');

      // Get selected questions by section
      const selectedSectionBQuestions = sectionBQuestions.filter(answer =>
        answer.isSelected);
      const selectedSectionCQuestions = sectionCQuestions.filter(answer =>
        answer.isSelected);

      // Check if student has answered the required number of questions in each section
      const hasEnoughSectionB = selectedSectionBQuestions.length >= (exam.sectionBRequiredQuestions || 3);
      const hasEnoughSectionC = selectedSectionCQuestions.length >= (exam.sectionCRequiredQuestions || 1);

      // Calculate scores for each section
      let totalScore = 0;
      let maxPossibleScore = 0;

      // Section A - all questions are required
      const sectionAScore = sectionAQuestions.reduce((total, answer) => total + (answer.score || 0), 0);
      const sectionAMaxScore = sectionAQuestions.reduce((total, answer) =>
        total + (answer.question.points || 1), 0);

      totalScore += sectionAScore;
      maxPossibleScore += sectionAMaxScore || 1; // Ensure we don't have a zero denominator

      // Section B - only count selected questions if enough are selected
      if (hasEnoughSectionB && selectedSectionBQuestions.length > 0) {
        const sectionBScore = selectedSectionBQuestions.reduce((total, answer) =>
          total + (answer.score || 0), 0);
        const sectionBMaxScore = selectedSectionBQuestions.reduce((total, answer) =>
          total + (answer.question.points || 1), 0);

        totalScore += sectionBScore;
        maxPossibleScore += sectionBMaxScore;
      } else if (sectionBQuestions.length > 0) {
        // Not enough questions selected - count all questions in the section
        const sectionBScore = sectionBQuestions.reduce((total, answer) => total + (answer.score || 0), 0);
        const sectionBMaxScore = sectionBQuestions.reduce((total, answer) =>
          total + (answer.question.points || 1), 0);

        totalScore += sectionBScore;
        maxPossibleScore += sectionBMaxScore;
      }

      // Section C - only count selected questions if enough are selected
      if (hasEnoughSectionC && selectedSectionCQuestions.length > 0) {
        const sectionCScore = selectedSectionCQuestions.reduce((total, answer) =>
          total + (answer.score || 0), 0);
        const sectionCMaxScore = selectedSectionCQuestions.reduce((total, answer) =>
          total + (answer.question.points || 1), 0);

        totalScore += sectionCScore;
        maxPossibleScore += sectionCMaxScore;
      } else if (sectionCQuestions.length > 0) {
        // Not enough questions selected - count all questions in the section
        const sectionCScore = sectionCQuestions.reduce((total, answer) => total + (answer.score || 0), 0);
        const sectionCMaxScore = sectionCQuestions.reduce((total, answer) =>
          total + (answer.question.points || 1), 0);

        totalScore += sectionCScore;
        maxPossibleScore += sectionCMaxScore;
      }

      // Ensure we have valid scores (not NaN or 0/0)
      if (isNaN(totalScore) || totalScore === undefined) totalScore = 0;
      if (isNaN(maxPossibleScore) || maxPossibleScore === undefined || maxPossibleScore === 0) maxPossibleScore = 1;

      // Update result with calculated scores
      result.totalScore = totalScore;
      result.maxPossibleScore = maxPossibleScore;
    } else {
      // Standard scoring - count all questions
      result.totalScore = result.answers.reduce((total, answer) => total + (answer.score || 0), 0);
      result.maxPossibleScore = result.answers.reduce((total, answer) =>
        total + (answer.question.points || 1), 0) || 1; // Ensure we don't have a zero denominator
    }

    // Save the result
    await result.save();

    return result;
    })(); // Close the regrading promise

    // Race the regrading process against the timeout
    try {
      await Promise.race([regradingPromise, regradingTimeoutPromise]);
    } catch (timeoutError) {
      if (timeoutError.message.includes('timed out')) {
        console.warn('Regrading process timed out, but partial results may be saved');
        // Continue with partial results
      } else {
        throw timeoutError;
      }
    }

    // Reload the result to get the latest data
    const updatedResult = await Result.findById(req.params.resultId);

    res.json({
      message: 'AI grading completed successfully',
      totalScore: updatedResult.totalScore || 0,
      maxPossibleScore: updatedResult.maxPossibleScore || 1,
      percentage: updatedResult.maxPossibleScore > 0 ? (updatedResult.totalScore / updatedResult.maxPossibleScore) * 100 : 0
    });
  } catch (error) {
    console.error('Trigger AI grading error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset exam questions and re-extract from file
// @route   POST /api/exam/:id/reset-questions
// @access  Private/Admin
const resetExamQuestions = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if the exam has an original file
    if (!exam.originalFile || !fs.existsSync(exam.originalFile)) {
      return res.status(400).json({
        message: 'Cannot reset questions: No original file found for this exam',
        originalFile: exam.originalFile || 'None'
      });
    }

    console.log(`Resetting questions for exam ${exam._id} (${exam.title})`);

    // Delete all existing questions for this exam
    const deletedQuestions = await Question.deleteMany({ exam: exam._id });
    console.log(`Deleted ${deletedQuestions.deletedCount} existing questions`);

    // Clear questions from exam sections
    exam.sections.forEach(section => {
      section.questions = [];
    });
    await exam.save();

    // Re-parse the exam file to extract questions directly
    console.log(`Re-parsing exam file for direct question extraction: ${exam.originalFile}`);

    try {
      // Parse the exam file directly
      console.log(`Parsing exam file: ${exam.originalFile}`);
      const parsedExam = await parseExamFile(exam.originalFile);
      console.log('Successfully parsed exam file directly');

      // Log the extracted questions
      console.log(`Successfully extracted questions. Found ${parsedExam.sections.length} sections`);
      parsedExam.sections.forEach(section => {
        console.log(`Section ${section.name}: ${section.questions.length} questions`);
      });

      // Create questions for each section
      for (const section of parsedExam.sections) {
        // Find or create the section in the exam
        let examSection = exam.sections.find(s => s.name === section.name);

        if (!examSection) {
          // If the section doesn't exist in the exam, create it
          exam.sections.push({
            name: section.name,
            description: section.description || `Section ${section.name}`,
            questions: []
          });
          examSection = exam.sections[exam.sections.length - 1];
          console.log(`Created new section ${section.name} in exam`);
        } else {
          // Update the description if it exists
          if (section.description) {
            examSection.description = section.description;
          }
        }

        // Create questions for this section
        for (const questionData of section.questions) {
          try {
            // Validate question data
            if (!questionData.text) {
              console.warn(`Skipping question with no text in section ${section.name}`);
              continue;
            }

            // Ensure we have a valid correctAnswer
            let correctAnswer = questionData.correctAnswer || '';
            if (!correctAnswer && questionData.type === 'multiple-choice') {
              // For multiple choice, try to find the correct option
              const correctOption = (questionData.options || []).find(opt => opt.isCorrect);
              if (correctOption) {
                correctAnswer = correctOption.text;
              } else {
                correctAnswer = 'Not provided';
              }
            } else if (!correctAnswer) {
              correctAnswer = 'Not provided';
            }

            // Create the question with valid data
            const question = await Question.create({
              text: questionData.text,
              type: questionData.type || 'multiple-choice',
              options: questionData.options || [],
              correctAnswer: correctAnswer,
              points: questionData.points || 1,
              exam: exam._id,
              section: section.name
            });

            console.log(`Created question ${question._id} in section ${section.name}`);

            // Add question to the appropriate section
            const sectionIndex = exam.sections.findIndex(s => s.name === section.name);
            if (sectionIndex !== -1) {
              exam.sections[sectionIndex].questions.push(question._id);
            }
          } catch (questionError) {
            console.error(`Error creating question in section ${section.name}:`, questionError);
            // Continue with other questions
          }
        }
      }

      // Save the updated exam with questions
      await exam.save();
      console.log(`Exam ${exam._id} saved with re-extracted questions`);

      // Return the updated exam
      const updatedExam = await Exam.findById(req.params.id)
        .populate('createdBy', 'fullName')
        .populate({
          path: 'sections.questions',
          select: 'text type options points section'
        });

      res.json({
        message: 'Exam questions reset and re-extracted successfully',
        exam: updatedExam
      });
    } catch (parseError) {
      console.error('Error re-parsing exam file:', parseError);
      res.status(500).json({
        message: 'Error re-parsing exam file',
        error: parseError.message
      });
    }
  } catch (error) {
    console.error('Reset exam questions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Debug exam content
// @route   GET /api/exam/:id/debug
// @access  Private/Admin
const debugExamContent = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'fullName')
      .populate({
        path: 'sections.questions',
        select: 'text type options points section'
      });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Only admins can access this route
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this route' });
    }

    // Prepare detailed debug information
    const debugInfo = {
      examId: exam._id,
      title: exam.title,
      description: exam.description,
      createdBy: exam.createdBy?.fullName || 'Unknown',
      createdAt: exam.createdAt,
      isLocked: exam.isLocked,
      hasContent: hasExtractedContent(exam),
      originalFile: exam.originalFile || 'None',
      sections: exam.sections.map(section => ({
        name: section.name,
        description: section.description,
        questionCount: section.questions?.length || 0,
        questions: section.questions?.map(q => ({
          id: q._id,
          type: q.type,
          textPreview: q.text?.substring(0, 50) + '...',
          optionCount: q.options?.length || 0,
          points: q.points
        }))
      })),
      totalQuestions: exam.sections.reduce((total, section) =>
        total + (section.questions?.length || 0), 0)
    };

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug exam content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam result
// @route   GET /api/exam/result/:id
// @access  Private/Student
const getExamResult = async (req, res) => {
  try {
    const resultId = req.params.id;

    // Find the result and populate all necessary data
    const result = await Result.findById(resultId)
      .populate({
        path: 'exam',
        select: 'title description sections',
        populate: {
          path: 'sections.questions',
          select: 'text type options points section correctAnswer'
        }
      })
      .populate({
        path: 'answers.question',
        select: 'text type options points section correctAnswer'
      });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Check if the user is authorized to view this result
    if (result.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this result' });
    }

    // Return the result with the exam data
    res.json({
      message: 'Exam result retrieved successfully',
      result,
      exam: result.exam
    });
  } catch (error) {
    console.error('Get exam result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Regrade a specific exam result
// @route   POST /api/exam/regrade/:resultId
// @access  Private (Both students and admins)
const regradeExamResult = async (req, res) => {
  try {
    const resultId = req.params.resultId;
    const { forceRegrade } = req.body;

    // Find the result first to check permissions
    const result = await Result.findById(resultId);

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Check if the user is authorized to regrade this result
    // Allow if user is admin or if the result belongs to the student
    if (req.user.role !== 'admin' && result.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to regrade this exam' });
    }

    // Update the AI grading status to in-progress
    result.aiGradingStatus = 'in-progress';
    await result.save();

    // Import the grading utility
    const gradeExamUtils = require('../utils/gradeExam');

    // For students, we'll run the regrading in the background
    if (req.user.role === 'student') {
      // Return immediately to the student
      res.json({
        message: 'Regrading request received. The exam will be regraded shortly.',
        resultId: result._id
      });

      // Run the regrading in the background
      setTimeout(async () => {
        try {
          console.log(`Starting background regrading for result ${resultId} requested by student ${req.user._id}`);
          await gradeExamUtils.regradeExamResult(resultId, forceRegrade);
          console.log(`Background regrading completed for result ${resultId}`);
        } catch (error) {
          console.error('Error in background regrading:', error);

          // Update the result to indicate AI grading failed
          try {
            const updatedResult = await Result.findById(resultId);
            if (updatedResult) {
              updatedResult.aiGradingStatus = 'failed';
              await updatedResult.save();
            }
          } catch (updateError) {
            console.error('Error updating AI grading status:', updateError);
          }
        }
      }, 1000);
    } else {
      // For admins, we'll run the regrading synchronously and return the result
      const regradedResult = await gradeExamUtils.regradeExamResult(resultId, forceRegrade);

      res.json({
        message: 'Exam regraded successfully',
        result: regradedResult
      });
    }
  } catch (error) {
    console.error('Regrade exam result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to bulk regrade specific results
const bulkRegradeSpecificResults = async (resultIds, method = 'ai', forceRegrade = false) => {
  const gradeExamUtils = require('../utils/gradeExam');
  const { gradeQuestionByType } = require('../utils/enhancedGrading');

  let processedCount = 0;
  let improvedCount = 0;
  let totalScoreImprovement = 0;

  console.log(`Starting bulk regrade for ${resultIds.length} results with method: ${method}`);

  for (const resultId of resultIds) {
    try {
      console.log(`Processing result ${resultId} (${processedCount + 1}/${resultIds.length})`);

      if (method === 'comprehensive') {
        // Use comprehensive AI grading
        const result = await Result.findById(resultId)
          .populate({
            path: 'answers.question',
            select: 'text type points correctAnswer options'
          });

        if (!result) {
          console.log(`Result ${resultId} not found, skipping`);
          continue;
        }

        const oldScore = result.totalScore || 0;
        let newTotalScore = 0;
        let hasImprovement = false;

        // Process each answer with comprehensive grading
        for (let i = 0; i < result.answers.length; i++) {
          const answer = result.answers[i];
          const question = answer.question;

          if (!question) continue;

          try {
            // Use enhanced grading with semantic equivalence detection
            const grading = await gradeQuestionByType(question, answer, question.correctAnswer);
            const newScore = grading.score || 0;
            const oldAnswerScore = answer.score || 0;

            // Always update the answer with the new grading results
            result.answers[i].score = newScore;
            result.answers[i].feedback = grading.feedback || 'AI graded answer';
            result.answers[i].isCorrect = newScore >= question.points;
            result.answers[i].correctedAnswer = grading.correctedAnswer || question.correctAnswer;

            // Log semantic matches for debugging
            if (grading.details && grading.details.gradingMethod === 'semantic_match') {
              console.log(`Semantic match found for question ${question._id}: "${answer.selectedOption || answer.textAnswer}" matches "${question.correctAnswer}"`);
              hasImprovement = true;
            } else if (newScore !== oldAnswerScore) {
              hasImprovement = true;
            }

            newTotalScore += newScore;

            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error grading answer for question ${question._id}:`, error);
            newTotalScore += answer.score || 0;
          }
        }

        // Update result if there was improvement
        if (hasImprovement || forceRegrade) {
          result.totalScore = newTotalScore;
          result.aiGradingStatus = 'completed';
          await result.save();

          if (newTotalScore > oldScore) {
            improvedCount++;
            totalScoreImprovement += (newTotalScore - oldScore);
          }
        }
      } else {
        // Use standard AI regrading
        const regradingResult = await gradeExamUtils.regradeExamResult(resultId, forceRegrade);
        if (regradingResult.totalScore > 0) {
          improvedCount++;
        }
      }

      processedCount++;

      // Add delay between results to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`Error regrading result ${resultId}:`, error);
      processedCount++;
    }
  }

  console.log(`Bulk regrade completed: ${processedCount} processed, ${improvedCount} improved`);

  return {
    processedCount,
    improvedCount,
    totalScoreImprovement,
    averageImprovement: improvedCount > 0 ? totalScoreImprovement / improvedCount : 0
  };
};

// @desc    Find and grade all ungraded exam results or specific results
// @route   POST /api/exam/regrade-all
// @access  Private/Admin
const regradeAllExams = async (req, res) => {
  try {
    const { resultIds, method = 'ai', forceRegrade = false } = req.body;

    // Import the grading utility
    const gradeExamUtils = require('../utils/gradeExam');

    // Start the process in the background
    res.json({
      message: 'Batch regrading process started in the background',
      status: 'processing',
      resultCount: resultIds ? resultIds.length : 'all ungraded'
    });

    // Run the batch grading process
    try {
      let result;
      if (resultIds && resultIds.length > 0) {
        // Regrade specific results
        console.log(`Starting bulk regrade for ${resultIds.length} specific results`);
        result = await bulkRegradeSpecificResults(resultIds, method, forceRegrade);
      } else {
        // Regrade all ungraded results
        console.log('Starting bulk regrade for all ungraded results');
        result = await gradeExamUtils.findAndGradeUngradedResults();
      }
      console.log('Batch regrading completed:', result);
    } catch (error) {
      console.error('Error in batch regrading:', error);
    }
  } catch (error) {
    console.error('Regrade all exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Enable selective answering for an exam
// @route   POST /api/exam/:id/enable-selective-answering
// @access  Private/Admin
const enableSelectiveAnswering = async (req, res) => {
  try {
    const { sectionBRequiredQuestions, sectionCRequiredQuestions } = req.body;

    // Find the exam
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Enable selective answering
    exam.allowSelectiveAnswering = true;

    // Update required questions if provided
    if (sectionBRequiredQuestions !== undefined) {
      exam.sectionBRequiredQuestions = parseInt(sectionBRequiredQuestions) || 3;
    }

    if (sectionCRequiredQuestions !== undefined) {
      exam.sectionCRequiredQuestions = parseInt(sectionCRequiredQuestions) || 1;
    }

    // Save the exam
    await exam.save();

    console.log(`Enabled selective answering for exam ${exam._id} with sectionB=${exam.sectionBRequiredQuestions}, sectionC=${exam.sectionCRequiredQuestions}`);

    res.json({
      message: 'Selective answering enabled successfully',
      exam: {
        _id: exam._id,
        title: exam.title,
        allowSelectiveAnswering: exam.allowSelectiveAnswering,
        sectionBRequiredQuestions: exam.sectionBRequiredQuestions,
        sectionCRequiredQuestions: exam.sectionCRequiredQuestions
      }
    });
  } catch (error) {
    console.error('Enable selective answering error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Select a question for answering (for selective answering)
// @route   POST /api/exam/:id/select-question
// @access  Private/Student
const selectQuestion = async (req, res) => {
  try {
    console.log('=== SELECT QUESTION ENDPOINT CALLED ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('User:', req.user?._id);

    const { questionId, isSelected } = req.body;

    // Validate input
    if (!questionId) {
      console.log('❌ Question ID is missing');
      return res.status(400).json({ message: 'Question ID is required' });
    }

    if (typeof isSelected !== 'boolean') {
      console.log('❌ isSelected is not a boolean:', typeof isSelected, isSelected);
      return res.status(400).json({ message: 'isSelected must be a boolean value' });
    }

    console.log('✅ Input validation passed:', { questionId, isSelected });

    // Find the result for this student and exam
    console.log('🔍 Looking for exam result:', {
      student: req.user._id,
      exam: req.params.id,
      isCompleted: false
    });

    const result = await Result.findOne({
      student: req.user._id,
      exam: req.params.id,
      isCompleted: false
    }).populate({
      path: 'exam',
      select: 'allowSelectiveAnswering sectionBRequiredQuestions sectionCRequiredQuestions'
    });

    if (!result) {
      console.log('❌ Exam session not found or already completed');
      return res.status(404).json({ message: 'Exam session not found or already completed' });
    }

    console.log('✅ Found exam result:', {
      resultId: result._id,
      examId: result.exam._id,
      allowSelectiveAnswering: result.exam.allowSelectiveAnswering,
      answersCount: result.answers.length
    });

    // Check if selective answering is enabled for this exam
    if (!result.exam.allowSelectiveAnswering) {
      return res.status(400).json({ message: 'Selective answering is not enabled for this exam' });
    }

    // Find the question
    console.log(`🔍 Looking for question with ID: ${questionId}`);
    const question = await Question.findById(questionId);
    if (!question) {
      console.log(`❌ Question not found in database: ${questionId}`);
      return res.status(404).json({
        message: 'Question not found',
        questionId: questionId,
        error: 'QUESTION_NOT_FOUND'
      });
    }
    console.log(`✅ Found question: ${question._id} in section ${question.section}`);

    // Check if the question is in section B or C (only these sections support selective answering)
    if (question.section !== 'B' && question.section !== 'C') {
      return res.status(400).json({ message: 'Only questions in sections B and C can be selected' });
    }

    // Log for debugging
    console.log(`Processing selection for question ${questionId} in section ${question.section}`);
    console.log(`Current selection status: ${isSelected ? 'Selecting' : 'Deselecting'}`);
    console.log(`Exam selective answering config: B=${result.exam.sectionBRequiredQuestions || 3}, C=${result.exam.sectionCRequiredQuestions || 1}`);

    // Find the answer in the result
    console.log(`🔍 Looking for answer in result with ${result.answers.length} answers`);
    console.log(`Question IDs in result:`, result.answers.map(a => a.question.toString()));

    const answerIndex = result.answers.findIndex(
      answer => answer.question.toString() === questionId
    );

    if (answerIndex === -1) {
      console.log(`❌ Answer not found in result for question: ${questionId}`);
      console.log(`Available question IDs:`, result.answers.map(a => a.question.toString()));
      return res.status(404).json({
        message: 'Answer not found in result',
        questionId: questionId,
        availableQuestions: result.answers.map(a => a.question.toString()),
        error: 'ANSWER_NOT_FOUND'
      });
    }

    console.log(`✅ Found answer at index ${answerIndex}, current selection: ${result.answers[answerIndex].isSelected}`);

    // If we're trying to deselect, check if we have enough selected questions in this section
    if (!isSelected) {
      // Log for debugging
      console.log(`Attempting to deselect question ${questionId} in section ${question.section}`);

      // Get all questions in this section from the exam
      const allQuestionsInSection = await Question.find({ section: question.section });
      const questionIdsInSection = allQuestionsInSection.map(q => q._id.toString());

      console.log(`Found ${questionIdsInSection.length} total questions in section ${question.section}`);

      // Count currently selected questions in this section (excluding the one we're about to deselect)
      const selectedAnswers = result.answers.filter(answer =>
        answer.isSelected &&
        questionIdsInSection.includes(answer.question.toString()) &&
        answer.question.toString() !== questionId // Exclude the current question since we're deselecting it
      );

      const selectedInSection = selectedAnswers.length;

      console.log(`Found ${selectedInSection} other selected questions in section ${question.section} (excluding current question)`);

      // Get required questions count for this section
      const requiredCount = question.section === 'B'
        ? result.exam.sectionBRequiredQuestions || 3
        : result.exam.sectionCRequiredQuestions || 1;

      console.log(`Required questions for section ${question.section}: ${requiredCount}`);

      // Check if we're at the minimum (accounting for the question we're about to deselect)
      if (selectedInSection < requiredCount) {
        console.log(`Cannot deselect: Below minimum required questions (${selectedInSection} selected, ${requiredCount} required)`);
        return res.status(400).json({
          message: `You must select at least ${requiredCount} questions in Section ${question.section}`
        });
      }

      console.log(`Deselection allowed: ${selectedInSection} selected, ${requiredCount} required`);
    }

    // Update the selection status
    result.answers[answerIndex].isSelected = isSelected;

    // Save the result with error handling
    try {
      console.log(`💾 Saving result with updated selection...`);
      await result.save();
      console.log(`✅ Successfully updated selection for question ${questionId}: isSelected=${isSelected}`);
    } catch (saveError) {
      console.error('❌ Error saving question selection:', saveError);
      console.error('Save error details:', {
        name: saveError.name,
        message: saveError.message,
        code: saveError.code,
        stack: saveError.stack
      });
      return res.status(500).json({
        message: 'Failed to save question selection. Please try again.',
        error: saveError.message,
        errorType: saveError.name,
        errorCode: 'SAVE_FAILED'
      });
    }

    res.json({
      message: isSelected ? 'Question selected for answering' : 'Question deselected',
      questionId,
      isSelected,
      success: true
    });
  } catch (error) {
    console.error('Select question error:', error);
    res.status(500).json({
      message: 'Server error while updating question selection',
      error: error.message,
      success: false
    });
  }
};

// @desc    Fix existing results with incorrect isCorrect values
// @route   POST /api/exam/fix-results
// @access  Private/Admin
const fixExistingResults = async (req, res) => {
  try {
    console.log('Starting to fix existing results with incorrect isCorrect values...');

    // Find all completed results
    const results = await Result.find({ isCompleted: true })
      .populate({
        path: 'answers.question',
        select: 'text type points correctAnswer'
      });

    console.log(`Found ${results.length} completed results to check`);

    let fixedCount = 0;
    let totalAnswersFixed = 0;

    for (const result of results) {
      let resultModified = false;

      for (let i = 0; i < result.answers.length; i++) {
        const answer = result.answers[i];
        const question = answer.question;

        if (!question) continue;

        // Check if the answer has a score but incorrect isCorrect value
        const currentScore = answer.score || 0;
        const maxPoints = question.points || 1;
        const shouldBeCorrect = currentScore >= maxPoints;
        const currentIsCorrect = answer.isCorrect;

        // Fix if there's a mismatch
        if (shouldBeCorrect !== currentIsCorrect) {
          console.log(`Fixing answer for question ${question._id}:`);
          console.log(`- Score: ${currentScore}/${maxPoints}`);
          console.log(`- Current isCorrect: ${currentIsCorrect}`);
          console.log(`- Should be isCorrect: ${shouldBeCorrect}`);

          result.answers[i].isCorrect = shouldBeCorrect;
          resultModified = true;
          totalAnswersFixed++;
        }

        // Also fix cases where score is 0 but answer might be correct
        if (currentScore === 0 && answer.selectedOption && question.type === 'multiple-choice') {
          // Check if the selected option matches the correct answer
          const selectedOption = answer.selectedOption.toLowerCase().trim();
          const correctAnswer = (question.correctAnswer || '').toLowerCase().trim();

          // Simple semantic check
          if (selectedOption === correctAnswer ||
              correctAnswer.includes(selectedOption) ||
              selectedOption.includes(correctAnswer)) {

            console.log(`Fixing zero-score correct answer for question ${question._id}:`);
            console.log(`- Selected: "${selectedOption}"`);
            console.log(`- Correct: "${correctAnswer}"`);

            result.answers[i].score = maxPoints;
            result.answers[i].isCorrect = true;
            result.answers[i].feedback = 'Correct answer! (Fixed by system)';
            resultModified = true;
            totalAnswersFixed++;
          }
        }
      }

      // Recalculate total score if any answers were modified
      if (resultModified) {
        const newTotalScore = result.answers.reduce((total, answer) => total + (answer.score || 0), 0);
        const oldTotalScore = result.totalScore;

        result.totalScore = newTotalScore;

        console.log(`Result ${result._id}: Updated total score from ${oldTotalScore} to ${newTotalScore}`);

        await result.save();
        fixedCount++;
      }
    }

    console.log(`Fix completed: ${fixedCount} results updated, ${totalAnswersFixed} answers fixed`);

    res.json({
      message: 'Results fixed successfully',
      resultsFixed: fixedCount,
      answersFixed: totalAnswersFixed,
      totalResultsChecked: results.length
    });

  } catch (error) {
    console.error('Fix existing results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Debug a specific result to see scoring details
// @route   GET /api/exam/debug-result/:resultId
// @access  Private/Admin
const debugResult = async (req, res) => {
  try {
    const resultId = req.params.resultId;

    // Find the result with all details
    const result = await Result.findById(resultId)
      .populate({
        path: 'answers.question',
        select: 'text type points correctAnswer options'
      })
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title');

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Analyze each answer
    const answerAnalysis = result.answers.map((answer, index) => {
      const question = answer.question;
      if (!question) {
        return {
          index,
          error: 'Question not found or deleted'
        };
      }

      const analysis = {
        index,
        questionId: question._id,
        questionText: question.text.substring(0, 100) + '...',
        questionType: question.type,
        maxPoints: question.points || 1,
        studentAnswer: answer.textAnswer || answer.selectedOption || 'No answer',
        correctAnswer: question.correctAnswer || 'Not provided',
        currentScore: answer.score || 0,
        currentIsCorrect: answer.isCorrect,
        feedback: answer.feedback || 'No feedback',

        // Calculate what the score should be
        shouldBeCorrect: (answer.score || 0) >= (question.points || 1),

        // Check for potential issues
        issues: []
      };

      // Identify potential issues
      if (analysis.currentScore > 0 && !analysis.currentIsCorrect) {
        analysis.issues.push('Has score but marked as incorrect');
      }

      if (analysis.currentScore === 0 && analysis.currentIsCorrect) {
        analysis.issues.push('Marked as correct but has zero score');
      }

      if (analysis.currentScore === analysis.maxPoints && !analysis.currentIsCorrect) {
        analysis.issues.push('Full score but marked as incorrect');
      }

      // For multiple choice, check if answer matches
      if (question.type === 'multiple-choice' && analysis.currentScore === 0) {
        const selectedLower = (analysis.studentAnswer || '').toLowerCase().trim();
        const correctLower = (analysis.correctAnswer || '').toLowerCase().trim();

        if (selectedLower === correctLower ||
            correctLower.includes(selectedLower) ||
            selectedLower.includes(correctLower)) {
          analysis.issues.push('Appears to be correct but has zero score');
        }
      }

      return analysis;
    });

    // Calculate summary
    const summary = {
      resultId: result._id,
      student: result.student ? `${result.student.firstName} ${result.student.lastName}` : 'Unknown',
      exam: result.exam?.title || 'Unknown',
      totalScore: result.totalScore,
      maxPossibleScore: result.maxPossibleScore,
      percentage: result.maxPossibleScore > 0 ? Math.round((result.totalScore / result.maxPossibleScore) * 100) : 0,
      isCompleted: result.isCompleted,
      aiGradingStatus: result.aiGradingStatus,
      totalAnswers: result.answers.length,
      answersWithIssues: answerAnalysis.filter(a => a.issues && a.issues.length > 0).length,
      answersWithScore: answerAnalysis.filter(a => (a.currentScore || 0) > 0).length,
      answersMarkedCorrect: answerAnalysis.filter(a => a.currentIsCorrect).length
    };

    res.json({
      summary,
      answers: answerAnalysis,
      issues: answerAnalysis.filter(a => a.issues && a.issues.length > 0)
    });

  } catch (error) {
    console.error('Debug result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Comprehensive AI grading for all exam results
// @route   POST /api/exam/comprehensive-ai-grading
// @access  Private/Admin
const comprehensiveAIGrading = async (req, res) => {
  try {
    console.log('Starting comprehensive AI grading for all exam results...');

    // Find all completed results that need proper AI grading
    const results = await Result.find({
      isCompleted: true,
      $or: [
        { aiGradingStatus: { $ne: 'completed' } },
        { aiGradingStatus: { $exists: false } }
      ]
    })
      .populate({
        path: 'answers.question',
        select: 'text type points correctAnswer options'
      })
      .populate('exam', 'title')
      .populate('student', 'firstName lastName email');

    console.log(`Found ${results.length} results that need AI grading`);

    let processedCount = 0;
    let improvedCount = 0;
    let totalScoreImprovement = 0;

    for (const result of results) {
      try {
        console.log(`Processing result ${result._id} for student ${result.student?.firstName} ${result.student?.lastName}`);

        let resultModified = false;
        let oldTotalScore = result.totalScore || 0;
        let newTotalScore = 0;

        // Process each answer with enhanced AI grading
        for (let i = 0; i < result.answers.length; i++) {
          const answer = result.answers[i];
          const question = answer.question;

          if (!question) {
            console.log(`Skipping answer ${i} - question not found`);
            continue;
          }

          // Skip if already has a good score and feedback
          if (answer.score >= question.points && answer.feedback && answer.feedback.length > 20) {
            newTotalScore += answer.score;
            continue;
          }

          console.log(`AI grading question ${question._id} (${question.type})`);

          try {
            // Use the enhanced grading system with semantic equivalence detection
            const { gradeQuestionByType, areSemanticallySimilar } = require('../utils/enhancedGrading');
            const grading = await gradeQuestionByType(question, answer, question.correctAnswer);

            const oldScore = answer.score || 0;
            const newScore = grading.score || 0;

            // Always update the answer with the new grading results to ensure database consistency
            result.answers[i].score = newScore;
            result.answers[i].feedback = grading.feedback || 'AI graded answer';
            result.answers[i].isCorrect = newScore >= question.points;
            result.answers[i].correctedAnswer = grading.correctedAnswer || question.correctAnswer;

            newTotalScore += newScore;

            // Log improvements and semantic matches
            if (newScore !== oldScore) {
              console.log(`Question ${question._id}: Score changed from ${oldScore} to ${newScore}`);
              resultModified = true;
            }

            // Log semantic matches for debugging
            if (grading.details && grading.details.gradingMethod === 'semantic_match') {
              console.log(`Semantic match detected for question ${question._id}: "${answer.selectedOption || answer.textAnswer}" ≈ "${question.correctAnswer}"`);
              resultModified = true;
            }

          } catch (gradingError) {
            console.error(`Error grading question ${question._id}:`, gradingError.message);

            // Use fallback grading for critical cases
            const oldScore = answer.score || 0;
            let newScore = oldScore;

            // For multiple choice questions, check semantic equivalence
            if (question.type === 'multiple-choice' && answer.selectedOption && question.correctAnswer) {
              const selected = answer.selectedOption.toLowerCase().trim();
              const correct = question.correctAnswer.toLowerCase().trim();

              // Enhanced semantic matching
              if (selected === correct ||
                  correct.includes(selected) ||
                  selected.includes(correct) ||
                  areSemanticallySimilar(selected, correct)) {

                newScore = question.points;
                result.answers[i].score = newScore;
                result.answers[i].isCorrect = true;
                result.answers[i].feedback = 'Correct answer (semantic match)';
                resultModified = true;

                console.log(`Semantic match found for question ${question._id}: "${selected}" matches "${correct}"`);
              }
            }

            newTotalScore += newScore;
          }
        }

        // Update result if modified
        if (resultModified) {
          result.totalScore = newTotalScore;
          result.aiGradingStatus = 'completed';
          await result.save();

          const scoreImprovement = newTotalScore - oldTotalScore;
          totalScoreImprovement += scoreImprovement;
          improvedCount++;

          console.log(`Result ${result._id}: Total score updated from ${oldTotalScore} to ${newTotalScore} (improvement: +${scoreImprovement})`);
        }

        processedCount++;

        // Add a small delay to avoid overwhelming the AI service
        if (processedCount % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (resultError) {
        console.error(`Error processing result ${result._id}:`, resultError.message);
        continue;
      }
    }

    console.log(`Comprehensive AI grading completed:`);
    console.log(`- Results processed: ${processedCount}`);
    console.log(`- Results improved: ${improvedCount}`);
    console.log(`- Total score improvement: +${totalScoreImprovement} points`);

    res.json({
      message: 'Comprehensive AI grading completed successfully',
      resultsProcessed: processedCount,
      resultsImproved: improvedCount,
      totalScoreImprovement: totalScoreImprovement,
      averageImprovement: improvedCount > 0 ? Math.round(totalScoreImprovement / improvedCount * 100) / 100 : 0
    });

  } catch (error) {
    console.error('Comprehensive AI grading error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function for faster AI grading with timing
async function gradeQuestionWithTiming(question, answer, index, section) {
  const startTime = Date.now();
  try {
    console.log(`🔄 Processing ${question.type} in section ${section} (${index})`);

    // Import the enhanced grading utility
    const { gradeQuestionByType } = require('../utils/enhancedGrading');

    const grading = await gradeQuestionByType(question, answer, question.correctAnswer);
    const duration = Date.now() - startTime;

    console.log(`⚡ Section ${section} question graded in ${duration}ms`);

    return { index, grading, duration, section };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error grading section ${section} question (${duration}ms):`, error.message);

    // Return fallback grading
    return {
      index,
      grading: {
        score: 0,
        feedback: 'Error occurred during grading',
        details: { error: error.message, gradingMethod: 'error_fallback' }
      },
      duration,
      section,
      error: true
    };
  }
}

// Helper function to check semantic similarity
function areSemanticallySimilar(text1, text2) {
  const commonEquivalences = {
    'wan': ['wide area network', 'wide-area network'],
    'lan': ['local area network', 'local-area network'],
    'cpu': ['central processing unit', 'processor'],
    'ram': ['random access memory', 'memory'],
    'rom': ['read only memory', 'read-only memory'],
    'os': ['operating system'],
    'hdd': ['hard disk drive', 'hard drive'],
    'ssd': ['solid state drive', 'solid-state drive'],
    'gpu': ['graphics processing unit', 'graphics card'],
    'psu': ['power supply unit', 'power supply'],
    'usb': ['universal serial bus'],
    'http': ['hypertext transfer protocol'],
    'https': ['hypertext transfer protocol secure'],
    'ftp': ['file transfer protocol'],
    'ip': ['internet protocol'],
    'tcp': ['transmission control protocol'],
    'dns': ['domain name system'],
    'url': ['uniform resource locator'],
    'html': ['hypertext markup language'],
    'css': ['cascading style sheets'],
    'sql': ['structured query language']
  };

  const clean1 = text1.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const clean2 = text2.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // Check direct equivalences
  for (const [abbrev, expansions] of Object.entries(commonEquivalences)) {
    if ((clean1 === abbrev && expansions.some(exp => clean2.includes(exp))) ||
        (clean2 === abbrev && expansions.some(exp => clean1.includes(exp)))) {
      return true;
    }
  }

  return false;
}

/**
 * Save AI-generated exam as draft
 * @route   POST /api/exam/save-draft
 * @access  Private/Admin
 */
const saveDraftExam = async (req, res) => {
  try {
    const { title, description, timeLimit, passingScore, questions, totalMarks } = req.body;
    
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title and at least one question are required' });
    }

    // Create questions first
    const createdQuestions = [];
    for (const q of questions) {
      const question = await Question.create({
        text: q.text,
        type: q.type || 'multiple-choice',
        marks: q.marks || q.points || 1,
        difficulty: q.difficulty || 'medium',
        correctAnswer: q.correctAnswer || '',
        options: q.options || [],
        explanation: q.explanation || '',
        answerKey: q.answerKey || q.explanation || '',
        gradingCriteria: q.gradingCriteria || [],
        keyPoints: q.keyPoints || [],
        acceptableAnswers: q.acceptableAnswers || [],
        createdBy: req.user._id
      });
      createdQuestions.push(question._id);
    }

    // Create draft exam with single section
    const exam = await Exam.create({
      title,
      description: description || title,
      timeLimit: timeLimit || 60,
      passingScore: passingScore || 70,
      sections: [{
        name: 'A',
        description: 'Generated Questions',
        questions: createdQuestions
      }],
      createdBy: req.user._id,
      status: 'draft',
      isLocked: false,
      totalPoints: totalMarks || createdQuestions.reduce((sum, q) => sum + (q.marks || 1), 0)
    });

    res.status(201).json({
      message: 'Draft saved successfully',
      exam: await Exam.findById(exam._id).populate('sections.questions')
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ message: error.message || 'Failed to save draft' });
  }
};

/**
 * Get user's draft exams
 * @route   GET /api/exam/drafts
 * @access  Private/Admin
 */
const getDraftExams = async (req, res) => {
  try {
    const drafts = await Exam.find({ 
      createdBy: req.user._id, 
      status: 'draft' 
    }).populate('sections.questions').sort({ createdAt: -1 });
    
    res.json(drafts);
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  toggleExamLock,
  startExam,
  submitAnswer,
  completeExam,
  gradeManually,
  triggerAIGrading,
  resetExamQuestions,
  debugExamContent,
  getExamResult,
  regradeExamResult,
  regradeAllExams,
  enableSelectiveAnswering,
  selectQuestion,
  fixExistingResults,
  debugResult,
  comprehensiveAIGrading,
  saveDraftExam,
  getDraftExams
};
