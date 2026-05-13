import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Paper,
  Divider
} from '@mui/material';

// Test data for all question types
const testQuestions = [
  {
    _id: 'test-mcq',
    type: 'multiple-choice',
    text: 'What is the primary function of a CPU?',
    section: 'A',
    points: 2,
    options: [
      { text: 'Store data permanently', letter: 'A', isCorrect: false },
      { text: 'Process instructions and perform calculations', letter: 'B', isCorrect: true },
      { text: 'Display graphics', letter: 'C', isCorrect: false },
      { text: 'Connect to the internet', letter: 'D', isCorrect: false }
    ]
  },
  {
    _id: 'test-tf',
    type: 'true-false',
    text: 'RAM is a type of permanent storage.',
    section: 'A',
    points: 1,
    options: [
      { text: 'True', letter: 'A', isCorrect: false },
      { text: 'False', letter: 'B', isCorrect: true }
    ]
  },
  {
    _id: 'test-fib',
    type: 'fill-in-blank',
    text: 'The _____ is responsible for managing computer hardware and software resources.',
    section: 'A',
    points: 2,
    correctAnswer: 'operating system'
  },
  {
    _id: 'test-matching',
    type: 'matching',
    text: 'Match the computer components with their functions:',
    section: 'A',
    points: 4,
    matchingPairs: {
      leftColumn: ['CPU', 'RAM', 'Hard Drive', 'GPU'],
      rightColumn: ['Processes data', 'Temporary storage', 'Permanent storage', 'Graphics processing'],
      correctPairs: [
        { left: 0, right: 0 },
        { left: 1, right: 1 },
        { left: 2, right: 2 },
        { left: 3, right: 3 }
      ]
    }
  },
  {
    _id: 'test-ordering',
    type: 'ordering',
    text: 'Arrange the following steps of the software development lifecycle in the correct order:',
    section: 'A',
    points: 3,
    itemsToOrder: {
      items: ['Testing', 'Planning', 'Implementation', 'Design', 'Deployment'],
      correctOrder: [1, 3, 2, 0, 4]
    }
  },
  {
    _id: 'test-dragdrop',
    type: 'drag-drop',
    text: 'Place the network devices in their appropriate network layers:',
    section: 'A',
    points: 4,
    dragDropData: {
      dropZones: ['Physical Layer', 'Data Link Layer', 'Network Layer', 'Application Layer'],
      draggableItems: ['Router', 'Switch', 'Hub', 'Web Server'],
      correctPlacements: [
        { item: 0, zone: 2 }, // Router -> Network Layer
        { item: 1, zone: 1 }, // Switch -> Data Link Layer
        { item: 2, zone: 0 }, // Hub -> Physical Layer
        { item: 3, zone: 3 }  // Web Server -> Application Layer
      ]
    }
  },
  {
    _id: 'test-short',
    type: 'open-ended',
    text: 'Explain the difference between hardware and software.',
    section: 'B',
    points: 10,
    correctAnswer: 'Hardware refers to physical components like CPU, RAM, and hard drives. Software refers to programs and applications that run on the hardware.'
  },
  {
    _id: 'test-essay',
    type: 'open-ended',
    text: 'Discuss the impact of artificial intelligence on modern society. Include both positive and negative aspects in your answer.',
    section: 'C',
    points: 25,
    correctAnswer: 'AI has revolutionized many industries through automation and data analysis...'
  }
];

// Helper functions (copied from ExamInterface)
const getQuestionTypeLabel = (type, section) => {
  switch (type) {
    case 'multiple-choice':
      return 'Multiple Choice';
    case 'true-false':
      return 'True/False';
    case 'fill-in-blank':
      return 'Fill in the Blank';
    case 'matching':
      return 'Matching';
    case 'ordering':
      return 'Ordering';
    case 'drag-drop':
      return 'Drag & Drop';
    case 'open-ended':
      return section === 'B' ? 'Short Answer' : 'Essay Question';
    default:
      return section === 'B' ? 'Short Answer' : 'Essay Question';
  }
};

const getQuestionTypeColor = (type, section) => {
  switch (type) {
    case 'multiple-choice':
      return 'primary';
    case 'true-false':
      return 'success';
    case 'fill-in-blank':
      return 'warning';
    case 'matching':
      return 'info';
    case 'ordering':
      return 'secondary';
    case 'drag-drop':
      return 'error';
    case 'open-ended':
      return section === 'B' ? 'info' : 'secondary';
    default:
      return section === 'B' ? 'info' : 'secondary';
  }
};

const QuestionTypeTest = () => {
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const currentQuestion = testQuestions[selectedQuestion];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center" color="primary">
        Question Type Display Test
      </Typography>
      
      <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
        This test demonstrates how all 7 question types are displayed in the exam interface.
      </Typography>

      {/* Question Type Selector */}
      <Paper sx={{ p: 2, mb: 4, bgcolor: 'background.default' }}>
        <Typography variant="h6" gutterBottom>
          Select Question Type to Test:
        </Typography>
        <Grid container spacing={1}>
          {testQuestions.map((question, index) => (
            <Grid item key={question._id}>
              <Chip
                label={getQuestionTypeLabel(question.type, question.section)}
                color={selectedQuestion === index ? getQuestionTypeColor(question.type, question.section) : 'default'}
                onClick={() => setSelectedQuestion(index)}
                variant={selectedQuestion === index ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Question Display */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          {/* Question Header */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" fontWeight="bold">
                Question {selectedQuestion + 1}
              </Typography>
              <Chip
                label={getQuestionTypeLabel(currentQuestion.type, currentQuestion.section)}
                color={getQuestionTypeColor(currentQuestion.type, currentQuestion.section)}
                size="small"
              />
            </Box>
            
            <Typography variant="h6" sx={{ mb: 2 }}>
              {currentQuestion.text}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip label={`Section ${currentQuestion.section}`} size="small" variant="outlined" />
              <Chip label={`${currentQuestion.points} points`} size="small" variant="outlined" />
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Question Type Header */}
          <Box sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: getQuestionTypeColor(currentQuestion.type, currentQuestion.section) + '.lighter',
            borderRadius: 1,
            border: '1px solid',
            borderColor: getQuestionTypeColor(currentQuestion.type, currentQuestion.section) + '.main'
          }}>
            <Typography variant="h6" fontWeight="bold" color={getQuestionTypeColor(currentQuestion.type, currentQuestion.section) + '.main'}>
              {getQuestionTypeLabel(currentQuestion.type, currentQuestion.section)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Answer this {currentQuestion.type.replace('-', ' ')} question carefully
            </Typography>
          </Box>

          {/* Question Content Preview */}
          <Box sx={{ p: 3, bgcolor: 'background.default', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="body1" color="text.secondary" align="center">
              <em>Question content would be rendered here using the enhanced components</em>
            </Typography>
            
            {/* Show question-specific details */}
            {currentQuestion.type === 'multiple-choice' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Options:</Typography>
                {currentQuestion.options.map((option, index) => (
                  <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                    {option.letter}. {option.text} {option.isCorrect && '✓'}
                  </Typography>
                ))}
              </Box>
            )}
            
            {currentQuestion.type === 'matching' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Matching Items:</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="bold">Column A:</Typography>
                    {currentQuestion.matchingPairs.leftColumn.map((item, index) => (
                      <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                        {index + 1}. {item}
                      </Typography>
                    ))}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="bold">Column B:</Typography>
                    {currentQuestion.matchingPairs.rightColumn.map((item, index) => (
                      <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                        {String.fromCharCode(65 + index)}. {item}
                      </Typography>
                    ))}
                  </Grid>
                </Grid>
              </Box>
            )}
            
            {currentQuestion.type === 'ordering' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Items to Order:</Typography>
                {currentQuestion.itemsToOrder.items.map((item, index) => (
                  <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                    • {item}
                  </Typography>
                ))}
              </Box>
            )}
            
            {currentQuestion.type === 'drag-drop' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Drag & Drop Setup:</Typography>
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Items: {currentQuestion.dragDropData.draggableItems.join(', ')}
                </Typography>
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Zones: {currentQuestion.dragDropData.dropZones.join(', ')}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setSelectedQuestion(Math.max(0, selectedQuestion - 1))}
              disabled={selectedQuestion === 0}
            >
              Previous Question
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => setSelectedQuestion(Math.min(testQuestions.length - 1, selectedQuestion + 1))}
              disabled={selectedQuestion === testQuestions.length - 1}
            >
              Next Question
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Summary */}
      <Paper sx={{ p: 3, bgcolor: 'success.lighter' }}>
        <Typography variant="h6" gutterBottom color="success.main">
          ✅ Enhanced Question Display Features
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" gutterBottom>
              • Clear question type identification
            </Typography>
            <Typography variant="body2" gutterBottom>
              • Responsive design for all devices
            </Typography>
            <Typography variant="body2" gutterBottom>
              • Interactive components for new question types
            </Typography>
            <Typography variant="body2" gutterBottom>
              • Visual feedback and progress indicators
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" gutterBottom>
              • Consistent styling across all question types
            </Typography>
            <Typography variant="body2" gutterBottom>
              • Clear instructions and guidance
            </Typography>
            <Typography variant="body2" gutterBottom>
              • Error prevention and validation
            </Typography>
            <Typography variant="body2" gutterBottom>
              • Accessibility features included
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default QuestionTypeTest;
