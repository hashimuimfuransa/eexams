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
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Error as ErrorIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ImportStudents = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for file upload
  const [file, setFile] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState([]);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importStats, setImportStats] = useState({
    total: 0,
    success: 0,
    errors: 0
  });
  const [sendInvitations, setSendInvitations] = useState(true);

  // Steps for the import process
  const steps = ['Upload File', 'Review Data', 'Import Results'];

  // Sample column mapping
  const columnMapping = [
    { field: 'firstName', header: 'First Name', required: true },
    { field: 'lastName', header: 'Last Name', required: true },
    { field: 'email', header: 'Email', required: true },
    { field: 'studentId', header: 'Student ID', required: true },
    { field: 'institution', header: 'Institution', required: false }
  ];

  // Handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Simulate reading the file
      setTimeout(() => {
        // Generate sample preview data
        const sampleData = [
          { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', studentId: 'S12345', institution: 'University of Example' },
          { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', studentId: 'S12346', institution: 'University of Example' },
          { firstName: 'Robert', lastName: 'Johnson', email: 'robert.johnson@example.com', studentId: 'S12347', institution: 'University of Example' },
          { firstName: 'Emily', lastName: 'Williams', email: 'emily.williams@example.com', studentId: 'S12348', institution: 'University of Example' },
          { firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@example.com', studentId: 'S12349', institution: 'University of Example' }
        ];
        setPreviewData(sampleData);
      }, 500);
    }
  };

  // Handle file upload
  const handleUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prevProgress) => {
        const newProgress = prevProgress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setActiveStep(1); // Move to review step
          return 100;
        }
        return newProgress;
      });
    }, 300);
  };

  // Handle import process
  const handleImport = () => {
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate import progress
    const interval = setInterval(() => {
      setUploadProgress((prevProgress) => {
        const newProgress = prevProgress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setActiveStep(2); // Move to results step
          setImportSuccess(true);
          setImportStats({
            total: previewData.length,
            success: previewData.length - 1,
            errors: 1
          });
          return 100;
        }
        return newProgress;
      });
    }, 300);
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0) {
      handleUpload();
    } else if (activeStep === 1) {
      handleImport();
    } else {
      // Reset and go back to students list
      navigate('/admin/students');
    }
  };

  // Handle back step
  const handleBack = () => {
    if (activeStep === 0) {
      navigate('/admin/students');
    } else {
      setActiveStep((prevStep) => prevStep - 1);
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setFile(null);
    setPreviewData([]);
  };

  // Handle invitation toggle
  const handleInvitationToggle = (event) => {
    setSendInvitations(event.target.checked);
  };

  // Download template
  const handleDownloadTemplate = () => {
    // In a real app, this would download a CSV template
    console.log('Downloading template...');
  };

  // Render content based on current step
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Upload CSV or Excel File
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload a CSV or Excel file containing student information. The file should have columns for first name, last name, email, and student ID.
            </Typography>

            <Box
              sx={{
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                borderRadius: 3,
                p: 3,
                textAlign: 'center',
                mb: 3,
                backgroundColor: alpha(theme.palette.primary.main, 0.03)
              }}
            >
              {file ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <DescriptionIcon sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 1 }} />
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(file.size / 1024).toFixed(2)} KB
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={handleRemoveFile}
                      sx={{ ml: 2 }}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  {isUploading && (
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={uploadProgress}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {uploadProgress}% Uploaded
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  <input
                    accept=".csv,.xlsx,.xls"
                    style={{ display: 'none' }}
                    id="file-upload"
                    type="file"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload">
                    <Button
                      variant="contained"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      sx={{
                        mb: 2,
                        borderRadius: 3,
                        px: 3,
                        py: 1.2,
                        boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
                      }}
                    >
                      Select File
                    </Button>
                  </label>
                  <Typography variant="body2" color="text.secondary">
                    Drag and drop a file here, or click to select a file
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Supported formats: .csv, .xlsx, .xls
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Divider sx={{ flex: 1, mr: 2 }} />
              <Typography variant="body2" color="text.secondary">OR</Typography>
              <Divider sx={{ flex: 1, ml: 2 }} />
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ borderRadius: 3 }}
              >
                Download Template
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Download a template file with the correct format
              </Typography>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Review Data
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Review the data from your file before importing. Make sure the columns are mapped correctly.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Column Mapping
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell>File Column</TableCell>
                      <TableCell>Maps To</TableCell>
                      <TableCell>Required</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {columnMapping.map((column) => (
                      <TableRow key={column.field}>
                        <TableCell>{column.header}</TableCell>
                        <TableCell>{column.field}</TableCell>
                        <TableCell>
                          {column.required ? (
                            <Chip
                              size="small"
                              color="primary"
                              label="Required"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              color="default"
                              label="Optional"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Data Preview
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell>First Name</TableCell>
                      <TableCell>Last Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Student ID</TableCell>
                      <TableCell>Institution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.firstName}</TableCell>
                        <TableCell>{row.lastName}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.studentId}</TableCell>
                        <TableCell>{row.institution}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Showing {previewData.length} of {previewData.length} records
              </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={sendInvitations}
                    onChange={handleInvitationToggle}
                    color="primary"
                  />
                }
                label="Send email invitations to imported students"
              />
            </Box>

            {isUploading && (
              <Box sx={{ width: '100%', mt: 3 }}>
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {uploadProgress}% Processed
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Import Results
            </Typography>

            {importSuccess ? (
              <Alert
                severity="success"
                sx={{
                  mb: 3,
                  borderRadius: 2,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.2)}`
                }}
              >
                Student import completed successfully!
              </Alert>
            ) : (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  borderRadius: 2,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.2)}`
                }}
              >
                There were errors during the import process.
              </Alert>
            )}

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                  }}
                >
                  <Typography variant="h4" fontWeight="bold" color="text.primary">
                    {importStats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Records
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                  }}
                >
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {importStats.success}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successfully Imported
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                  }}
                >
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {importStats.errors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Errors
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {importStats.errors > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Error Details
                </Typography>
                <List
                  sx={{
                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.error.main, 0.05)
                  }}
                >
                  <ListItem>
                    <ListItemIcon>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Duplicate student ID: S12349"
                      secondary="Row 5: Michael Brown"
                    />
                  </ListItem>
                </List>
              </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/admin/students')}
                sx={{
                  borderRadius: 3,
                  px: 4,
                  py: 1.2,
                  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
                }}
              >
                View All Students
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
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
            Import Students
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Import multiple students from a CSV or Excel file
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{
            borderRadius: 3,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          {activeStep === 0 ? 'Back to Students' : 'Back'}
        </Button>
      </Box>

      {/* Stepper */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          p: { xs: 2, md: 3 },
          mb: 3
        }}
      >
        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{
            mb: 3,
            '& .MuiStepLabel-label': {
              mt: 1
            }
          }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Main content */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          p: { xs: 2, md: 3 },
          mb: 3
        }}
      >
        {renderStepContent()}
      </Paper>

      {/* Action buttons */}
      {activeStep < 2 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={!file || isUploading}
            startIcon={activeStep === 1 ? <PlayArrowIcon /> : null}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.2,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {activeStep === 0 ? 'Upload & Continue' : 'Import Students'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ImportStudents;
