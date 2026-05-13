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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Card,
  CardContent,
  CardActions,
  Menu,
  MenuItem,
  Tooltip,
  Avatar,
  AvatarGroup
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const StudentGroups = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for groups
  const [groups, setGroups] = useState([
    {
      id: '1',
      name: 'Biology Class A',
      description: 'Students in Biology Class A for the 2023 academic year',
      students: 24,
      createdAt: '2023-05-10',
      studentList: [
        { id: '1', name: 'John Doe', email: 'john.doe@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane.smith@example.com' },
        { id: '3', name: 'Robert Johnson', email: 'robert.johnson@example.com' }
      ]
    },
    {
      id: '2',
      name: 'Chemistry Class B',
      description: 'Students in Chemistry Class B for the 2023 academic year',
      students: 18,
      createdAt: '2023-05-12',
      studentList: [
        { id: '4', name: 'Emily Williams', email: 'emily.williams@example.com' },
        { id: '5', name: 'Michael Brown', email: 'michael.brown@example.com' }
      ]
    },
    {
      id: '3',
      name: 'Physics Group',
      description: 'Advanced physics students',
      students: 15,
      createdAt: '2023-05-15',
      studentList: [
        { id: '6', name: 'Sarah Johnson', email: 'sarah.johnson@example.com' },
        { id: '7', name: 'David Lee', email: 'david.lee@example.com' }
      ]
    },
    {
      id: '4',
      name: 'Mathematics Advanced',
      description: 'Advanced mathematics students',
      students: 12,
      createdAt: '2023-05-18',
      studentList: [
        { id: '8', name: 'Lisa Chen', email: 'lisa.chen@example.com' },
        { id: '9', name: 'Kevin Wang', email: 'kevin.wang@example.com' }
      ]
    },
    {
      id: '5',
      name: 'English Literature 101',
      description: 'Introduction to English Literature',
      students: 30,
      createdAt: '2023-05-20',
      studentList: [
        { id: '10', name: 'Amanda Taylor', email: 'amanda.taylor@example.com' },
        { id: '11', name: 'James Wilson', email: 'james.wilson@example.com' }
      ]
    }
  ]);

  // State for search
  const [searchTerm, setSearchTerm] = useState('');

  // State for dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addStudentsDialogOpen, setAddStudentsDialogOpen] = useState(false);
  const [viewStudentsDialogOpen, setViewStudentsDialogOpen] = useState(false);

  // State for selected group
  const [selectedGroup, setSelectedGroup] = useState(null);

  // State for new group
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });

  // State for menu
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuGroupId, setMenuGroupId] = useState(null);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Filter groups based on search term
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle menu open
  const handleMenuOpen = (event, groupId) => {
    setAnchorEl(event.currentTarget);
    setMenuGroupId(groupId);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuGroupId(null);
  };

  // Handle create dialog open
  const handleCreateDialogOpen = () => {
    setNewGroup({
      name: '',
      description: ''
    });
    setCreateDialogOpen(true);
  };

  // Handle create dialog close
  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };

  // Handle edit dialog open
  const handleEditDialogOpen = (group) => {
    setSelectedGroup(group);
    setNewGroup({
      name: group.name,
      description: group.description
    });
    setEditDialogOpen(true);
    handleMenuClose();
  };

  // Handle edit dialog close
  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
  };

  // Handle delete dialog open
  const handleDeleteDialogOpen = (group) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  // Handle delete dialog close
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
  };

  // Handle view students dialog open
  const handleViewStudentsDialogOpen = (group) => {
    setSelectedGroup(group);
    setViewStudentsDialogOpen(true);
  };

  // Handle view students dialog close
  const handleViewStudentsDialogClose = () => {
    setViewStudentsDialogOpen(false);
  };

  // Handle add students dialog open
  const handleAddStudentsDialogOpen = (group) => {
    setSelectedGroup(group);
    setAddStudentsDialogOpen(true);
    handleMenuClose();
  };

  // Handle add students dialog close
  const handleAddStudentsDialogClose = () => {
    setAddStudentsDialogOpen(false);
  };

  // Handle input change for new group
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGroup({
      ...newGroup,
      [name]: value
    });
  };

  // Handle create group
  const handleCreateGroup = () => {
    const newGroupObj = {
      id: (groups.length + 1).toString(),
      name: newGroup.name,
      description: newGroup.description,
      students: 0,
      createdAt: new Date().toISOString().split('T')[0],
      studentList: []
    };

    setGroups([...groups, newGroupObj]);
    handleCreateDialogClose();
  };

  // Handle edit group
  const handleEditGroup = () => {
    const updatedGroups = groups.map(group => {
      if (group.id === selectedGroup.id) {
        return {
          ...group,
          name: newGroup.name,
          description: newGroup.description
        };
      }
      return group;
    });

    setGroups(updatedGroups);
    handleEditDialogClose();
  };

  // Handle delete group
  const handleDeleteGroup = () => {
    const updatedGroups = groups.filter(group => group.id !== selectedGroup.id);
    setGroups(updatedGroups);
    handleDeleteDialogClose();
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
            Student Groups
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Organize students into groups for easier management
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
            onClick={() => navigate('/admin/students')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Students
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
            Create Group
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
          placeholder="Search groups by name or description..."
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            sx: { borderRadius: 3 }
          }}
          size="small"
        />
      </Paper>

      {/* Groups grid */}
      <Grid container spacing={3}>
        {filteredGroups.map(group => (
          <Grid item xs={12} sm={6} md={4} key={group.id}>
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
                      <GroupIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold" noWrap>
                      {group.name}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, group.id)}
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
                  {group.description}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Students
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {group.students}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {group.createdAt}
                    </Typography>
                  </Box>
                </Box>

                {group.studentList.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Members
                    </Typography>
                    <AvatarGroup max={5} sx={{ justifyContent: 'flex-start' }}>
                      {group.studentList.map(student => (
                        <Tooltip title={student.name} key={student.id}>
                          <Avatar
                            sx={{
                              width: 30,
                              height: 30,
                              fontSize: '0.875rem',
                              bgcolor: theme.palette.primary.main
                            }}
                          >
                            {student.name.charAt(0)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                  </Box>
                )}
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  onClick={() => handleViewStudentsDialogOpen(group)}
                  sx={{ mr: 1 }}
                >
                  View Students
                </Button>
                <Button
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={() => handleAddStudentsDialogOpen(group)}
                >
                  Add Students
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty state */}
      {filteredGroups.length === 0 && (
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
          <GroupIcon sx={{ fontSize: 60, color: alpha(theme.palette.text.secondary, 0.2), mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Student Groups Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm ? 'No groups match your search criteria.' : 'You haven\'t created any student groups yet.'}
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
              Create Your First Group
            </Button>
          )}
        </Paper>
      )}

      {/* Group menu */}
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
            const group = groups.find(g => g.id === menuGroupId);
            handleEditDialogOpen(group);
          }}
          sx={{ py: 1.5 }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2">Edit Group</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const group = groups.find(g => g.id === menuGroupId);
            handleAddStudentsDialogOpen(group);
          }}
          sx={{ py: 1.5 }}
        >
          <PersonAddIcon fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2">Add Students</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const group = groups.find(g => g.id === menuGroupId);
            handleDeleteDialogOpen(group);
          }}
          sx={{ py: 1.5 }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.error.main }} />
          <Typography variant="body2" color="error">Delete Group</Typography>
        </MenuItem>
      </Menu>

      {/* Create Group Dialog */}
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
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Group Name"
            type="text"
            fullWidth
            value={newGroup.name}
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
            value={newGroup.description}
            onChange={handleInputChange}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCreateDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateGroup}
            variant="contained"
            disabled={!newGroup.name}
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog */}
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
        <DialogTitle>Edit Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Group Name"
            type="text"
            fullWidth
            value={newGroup.name}
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
            value={newGroup.description}
            onChange={handleInputChange}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleEditDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleEditGroup}
            variant="contained"
            disabled={!newGroup.name}
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Group Dialog */}
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
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete the group "{selectedGroup?.name}"? This action cannot be undone.
          </Typography>
          {selectedGroup?.students > 0 && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              Warning: This group contains {selectedGroup?.students} students. Deleting this group will remove these students from the group, but will not delete the students themselves.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleDeleteDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteGroup}
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

      {/* View Students Dialog */}
      <Dialog
        open={viewStudentsDialogOpen}
        onClose={handleViewStudentsDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle>
          Students in {selectedGroup?.name}
        </DialogTitle>
        <DialogContent>
          {selectedGroup?.studentList.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No students in this group yet.
            </Typography>
          ) : (
            <List>
              {selectedGroup?.studentList.map(student => (
                <ListItem key={student.id} divider>
                  <ListItemText
                    primary={student.name}
                    secondary={student.email}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" color="error" size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleViewStudentsDialogClose}
            variant="outlined"
            sx={{ borderRadius: 3 }}
          >
            Close
          </Button>
          <Button
            onClick={() => {
              handleViewStudentsDialogClose();
              handleAddStudentsDialogOpen(selectedGroup);
            }}
            variant="contained"
            startIcon={<PersonAddIcon />}
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Add Students
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Students Dialog */}
      <Dialog
        open={addStudentsDialogOpen}
        onClose={handleAddStudentsDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle>
          Add Students to {selectedGroup?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select students to add to this group.
          </Typography>

          <TextField
            margin="dense"
            label="Search Students"
            type="text"
            fullWidth
            size="small"
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              sx: { borderRadius: 3 }
            }}
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" gutterBottom>
            Available Students
          </Typography>

          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {[
              { id: '12', name: 'Thomas Anderson', email: 'thomas.anderson@example.com' },
              { id: '13', name: 'Olivia Martinez', email: 'olivia.martinez@example.com' },
              { id: '14', name: 'William Johnson', email: 'william.johnson@example.com' },
              { id: '15', name: 'Sophia Garcia', email: 'sophia.garcia@example.com' },
              { id: '16', name: 'Benjamin Taylor', email: 'benjamin.taylor@example.com' }
            ].map(student => (
              <ListItem key={student.id} divider>
                <ListItemText
                  primary={student.name}
                  secondary={student.email}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" color="primary" size="small">
                    <AddIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleAddStudentsDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>
            Cancel
          </Button>
          <Button
            onClick={handleAddStudentsDialogClose}
            variant="contained"
            sx={{
              borderRadius: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Add Selected Students
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentGroups;
