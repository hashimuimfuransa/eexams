import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  useTheme,
  alpha,
  Card,
  CardContent,
  CardActions,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ExamTemplates = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for templates
  const [templates, setTemplates] = useState([
    {
      id: '1',
      title: 'Biology Midterm Template',
      description: 'Standard template for biology midterm exams with multiple choice and short answer questions',
      questionCount: 25,
      timeLimit: 60,
      createdAt: '2023-05-10',
      categories: ['Biology', 'Science', 'Midterm'],
      questionTypes: ['Multiple Choice', 'Short Answer']
    },
    {
      id: '2',
      title: 'Chemistry Quiz Template',
      description: 'Quick quiz template for chemistry classes with multiple choice questions',
      questionCount: 15,
      timeLimit: 30,
      createdAt: '2023-05-12',
      categories: ['Chemistry', 'Science', 'Quiz'],
      questionTypes: ['Multiple Choice']
    },
    {
      id: '3',
      title: 'Physics Final Exam Template',
      description: 'Comprehensive final exam template for physics with various question types',
      questionCount: 40,
      timeLimit: 120,
      createdAt: '2023-05-15',
      categories: ['Physics', 'Science', 'Final'],
      questionTypes: ['Multiple Choice', 'Short Answer', 'Problem Solving']
    },
    {
      id: '4',
      title: 'Mathematics Problem Set',
      description: 'Template for mathematics problem sets with calculation and proof questions',
      questionCount: 20,
      timeLimit: 90,
      createdAt: '2023-05-18',
      categories: ['Mathematics', 'Problem Set'],
      questionTypes: ['Problem Solving', 'Proof']
    },
    {
      id: '5',
      title: 'English Essay Exam',
      description: 'Template for English literature essay exams with long-form questions',
      questionCount: 3,
      timeLimit: 180,
      createdAt: '2023-05-20',
      categories: ['English', 'Literature', 'Essay'],
      questionTypes: ['Essay']
    }
  ]);

  // State for search
  const [searchTerm, setSearchTerm] = useState('');

  // State for dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // State for selected template
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // State for new template
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    description: '',
    timeLimit: 60,
    categories: []
  });

  // State for menu
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTemplateId, setMenuTemplateId] = useState(null);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Filter templates based on search term
  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.categories.some(category => category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle menu open
  const handleMenuOpen = (event, templateId) => {
    setAnchorEl(event.currentTarget);
    setMenuTemplateId(templateId);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuTemplateId(null);
  };

  // Handle create dialog open
  const handleCreateDialogOpen = () => {
    setNewTemplate({
      title: '',
      description: '',
      timeLimit: 60,
      categories: []
    });
    setCreateDialogOpen(true);
  };

  // Handle create dialog close
  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };

  // Handle edit dialog open
  const handleEditDialogOpen = (template) => {
    setSelectedTemplate(template);
    setNewTemplate({
      title: template.title,
      description: template.description,
      timeLimit: template.timeLimit,
      categories: [...template.categories]
    });
    setEditDialogOpen(true);
    handleMenuClose();
  };

  // Handle edit dialog close
  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
  };

  // Handle delete dialog open
  const handleDeleteDialogOpen = (template) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  // Handle delete dialog close
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
  };

  // Handle duplicate dialog open
  const handleDuplicateDialogOpen = (template) => {
    setSelectedTemplate(template);
    setNewTemplate({
      title: `Copy of ${template.title}`,
      description: template.description,
      timeLimit: template.timeLimit,
      categories: [...template.categories]
    });
    setDuplicateDialogOpen(true);
    handleMenuClose();
  };

  // Handle duplicate dialog close
  const handleDuplicateDialogClose = () => {
    setDuplicateDialogOpen(false);
  };

  // Handle input change for new template
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTemplate({
      ...newTemplate,
      [name]: name === 'timeLimit' ? parseInt(value, 10) : value
    });
  };

  // Handle category input
  const handleCategoryInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const newCategory = e.target.value.trim();
      if (!newTemplate.categories.includes(newCategory)) {
        setNewTemplate({
          ...newTemplate,
          categories: [...newTemplate.categories, newCategory]
        });
      }
      e.target.value = '';
    }
  };

  // Handle category delete
  const handleCategoryDelete = (categoryToDelete) => {
    setNewTemplate({
      ...newTemplate,
      categories: newTemplate.categories.filter(category => category !== categoryToDelete)
    });
  };

  // Handle create template
  const handleCreateTemplate = () => {
    const newTemplateObj = {
      id: (templates.length + 1).toString(),
      title: newTemplate.title,
      description: newTemplate.description,
      questionCount: 0,
      timeLimit: newTemplate.timeLimit,
      createdAt: new Date().toISOString().split('T')[0],
      categories: newTemplate.categories,
      questionTypes: []
    };

    setTemplates([...templates, newTemplateObj]);
    handleCreateDialogClose();
  };

  // Handle edit template
  const handleEditTemplate = () => {
    const updatedTemplates = templates.map(template => {
      if (template.id === selectedTemplate.id) {
        return {
          ...template,
          title: newTemplate.title,
          description: newTemplate.description,
          timeLimit: newTemplate.timeLimit,
          categories: newTemplate.categories
        };
      }
      return template;
    });

    setTemplates(updatedTemplates);
    handleEditDialogClose();
  };

  // Handle duplicate template
  const handleDuplicateTemplate = () => {
    const duplicatedTemplate = {
      ...selectedTemplate,
      id: (templates.length + 1).toString(),
      title: newTemplate.title,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setTemplates([...templates, duplicatedTemplate]);
    handleDuplicateDialogClose();
  };

  // Handle delete template
  const handleDeleteTemplate = () => {
    const updatedTemplates = templates.filter(template => template.id !== selectedTemplate.id);
    setTemplates(updatedTemplates);
    handleDeleteDialogClose();
  };

  // Handle use template
  const handleUseTemplate = (template) => {
    // In a real app, this would navigate to create exam with template
    console.log('Using template:', template);
    navigate('/admin/exams/create');
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{
        mb: { xs: 2, md: 4 },
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
          >
            Exam Templates
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Create and manage reusable exam templates
          </Typography>
        </Box>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          gap: { xs: 1, sm: 2 }
        }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/exams')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Exams
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateDialogOpen}
            sx={{
              borderRadius: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.2 },
              width: { xs: '100%', sm: 'auto' },
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Create Template
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          mb: { xs: 2, md: 3 },
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <TextField
          fullWidth
          placeholder="Search templates by title, description, or category..."
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            sx: { borderRadius: 3 }
          }}
          size="small"
        />
      </Paper>

      {/* Templates grid */}
      <Grid container spacing={3}>
        {filteredTemplates.map(template => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
                  transform: 'translateY(-5px)'
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        mr: 1.5
                      }}
                    >
                      <DescriptionIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold" noWrap>
                      {template.title}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, template.id)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    height: '40px'
                  }}
                >
                  {template.description}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Questions
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {template.questionCount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Time Limit
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {template.timeLimit} min
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {template.createdAt}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Categories
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {template.categories.map((category, index) => (
                      <Chip
                        key={index}
                        label={category}
                        size="small"
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                          fontSize: '0.7rem'
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Question Types
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {template.questionTypes.map((type, index) => (
                      <Chip
                        key={index}
                        label={type}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleUseTemplate(template)}
                  sx={{
                    mr: 1,
                    borderRadius: 2,
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`
                  }}
                >
                  Use Template
                </Button>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleDuplicateDialogOpen(template)}
                >
                  Duplicate
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty state */}
      {filteredTemplates.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.5)
          }}
        >
          <DescriptionIcon sx={{ fontSize: 60, color: alpha(theme.palette.text.secondary, 0.2), mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Templates Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm ? 'No templates match your search criteria.' : 'You haven\'t created any exam templates yet.'}
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateDialogOpen}
              sx={{
                borderRadius: 3,
                px: 3,
                py: 1,
                boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
              }}
            >
              Create Your First Template
            </Button>
          )}
        </Paper>
      )}

      {/* Template menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
            width: { xs: 200, sm: 220 },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'none' },
            left: { xs: '16px !important', sm: 'auto !important' },
            right: { xs: '16px !important', sm: 'auto !important' }
          }
        }}
      >
        <MenuItem
          onClick={() => {
            const template = templates.find(t => t.id === menuTemplateId);
            handleUseTemplate(template);
          }}
          sx={{ py: 1.5 }}
        >
          <AssignmentIcon fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2">Use Template</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const template = templates.find(t => t.id === menuTemplateId);
            handleEditDialogOpen(template);
          }}
          sx={{ py: 1.5 }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2">Edit Template</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const template = templates.find(t => t.id === menuTemplateId);
            handleDuplicateDialogOpen(template);
          }}
          sx={{ py: 1.5 }}
        >
          <ContentCopyIcon fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2">Duplicate</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const template = templates.find(t => t.id === menuTemplateId);
            handleDeleteDialogOpen(template);
          }}
          sx={{ py: 1.5 }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.error.main }} />
          <Typography variant="body2" color="error">Delete Template</Typography>
        </MenuItem>
      </Menu>

      {/* Create Template Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCreateDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="title"
            label="Template Name"
            type="text"
            fullWidth
            value={newTemplate.title}
            onChange={handleInputChange}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={newTemplate.description}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="timeLimit"
            label="Time Limit (minutes)"
            type="number"
            fullWidth
            value={newTemplate.timeLimit}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" gutterBottom>
            Categories
          </Typography>
          <TextField
            margin="dense"
            label="Add Category (press Enter)"
            type="text"
            fullWidth
            onKeyDown={handleCategoryInput}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {newTemplate.categories.map((category, index) => (
              <Chip
                key={index}
                label={category}
                onDelete={() => handleCategoryDelete(category)}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCreateDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTemplate}
            variant="contained"
            disabled={!newTemplate.title}
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle>Edit Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="title"
            label="Template Name"
            type="text"
            fullWidth
            value={newTemplate.title}
            onChange={handleInputChange}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={newTemplate.description}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="timeLimit"
            label="Time Limit (minutes)"
            type="number"
            fullWidth
            value={newTemplate.timeLimit}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" gutterBottom>
            Categories
          </Typography>
          <TextField
            margin="dense"
            label="Add Category (press Enter)"
            type="text"
            fullWidth
            onKeyDown={handleCategoryInput}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {newTemplate.categories.map((category, index) => (
              <Chip
                key={index}
                label={category}
                onDelete={() => handleCategoryDelete(category)}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleEditDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleEditTemplate}
            variant="contained"
            disabled={!newTemplate.title}
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Template Dialog */}
      <Dialog
        open={duplicateDialogOpen}
        onClose={handleDuplicateDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle>Duplicate Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a copy of "{selectedTemplate?.title}" with a new name.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            name="title"
            label="New Template Name"
            type="text"
            fullWidth
            value={newTemplate.title}
            onChange={handleInputChange}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleDuplicateDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDuplicateTemplate}
            variant="contained"
            disabled={!newTemplate.title}
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Duplicate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Template Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete the template "{selectedTemplate?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleDeleteDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteTemplate}
            variant="contained"
            color="error"
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.error.main, 0.3)}`
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExamTemplates;
