import React, { useState, useRef } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Button,
  IconButton,
  Alert,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  CheckCircleOutline,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const TOKEN = {
  radius: '6px',
  transition: 'all 0.18s ease',
  fontSans: "'IBM Plex Sans', 'Segoe UI', sans-serif",
};

const Shell = styled(Paper)(({ theme }) => ({
  border: `1.5px solid ${theme.palette.divider}`,
  borderRadius: '10px',
  overflow: 'hidden',
  boxShadow: theme.shadows[1],
  fontFamily: TOKEN.fontSans,
}));

const ImagePreviewBox = styled(Box)(({ theme }) => ({
  width: '100%',
  minHeight: '200px',
  maxHeight: '400px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  border: `2px dashed ${theme.palette.divider}`,
  borderRadius: TOKEN.radius,
  overflow: 'hidden',
  position: 'relative',
}));

const ImageAnswer = ({ question, answer, onAnswerChange, disabled }) => {
  const [textValue, setTextValue] = useState(answer?.textAnswer || '');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setTextValue(val);
    
    // Combine text answer with image info
    let combinedAnswer = val;
    if (uploadedImage) {
      combinedAnswer = `[IMAGE_UPLOADED: ${uploadedImage.name}] ${val}`;
    }
    
    onAnswerChange(question._id, combinedAnswer || '', 'image-based');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploadedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Update answer with image info
    let combinedAnswer = textValue;
    combinedAnswer = `[IMAGE_UPLOADED: ${file.name}] ${textValue}`;
    onAnswerChange(question._id, combinedAnswer || '', 'image-based');
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Update answer without image
    onAnswerChange(question._id, textValue || '', 'image-based');
  };

  const handleUploadClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const questionImageUrl = question.imageUrl || question.image;
  const hasContent = textValue.trim() || uploadedImage || questionImageUrl;

  return (
    <Box sx={{ mt: 2 }}>
      <Shell elevation={0}>
        {/* Question Image (if provided by exam creator) */}
        {questionImageUrl && (
          <Box sx={{ p: 2, borderBottom: `1px solid` }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Question Image:
            </Typography>
            <img
              src={questionImageUrl}
              alt="Question"
              style={{
                width: '100%',
                maxWidth: '500px',
                maxHeight: '300px',
                objectFit: 'contain',
                borderRadius: TOKEN.radius,
              }}
            />
          </Box>
        )}

        {/* Student Image Upload Section */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {questionImageUrl ? 'Upload your answer image (optional):' : 'Upload an image to answer this question:'}
          </Typography>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: 'none' }}
            disabled={disabled}
          />

          {!imagePreview ? (
            <ImagePreviewBox onClick={handleUploadClick} sx={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <ImageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Click to upload an image
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  (JPEG, PNG, max 5MB)
                </Typography>
              </Box>
            </ImagePreviewBox>
          ) : (
            <Box sx={{ position: 'relative' }}>
              <img
                src={imagePreview}
                alt="Uploaded preview"
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  borderRadius: TOKEN.radius,
                }}
              />
              {!disabled && (
                <IconButton
                  onClick={handleRemoveImage}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'error.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'error.dark',
                    },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
              <Box sx={{ mt: 1 }}>
                <Chip
                  icon={<UploadIcon />}
                  label={uploadedImage?.name}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* Text Answer Section */}
        <Box sx={{ p: 2, borderTop: `1px solid` }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Written Answer:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="Describe what you see in the image or answer the question about it..."
            value={textValue}
            onChange={handleTextChange}
            disabled={disabled}
            variant="outlined"
            inputProps={{
              style: { fontFamily: TOKEN.fontSans, fontSize: '0.9375rem', lineHeight: 1.7 },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: TOKEN.radius,
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: 'text.secondary' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: TOKEN.fontSans }}>
              {textValue.length} characters
            </Typography>
            {textValue.length > 10 && (
              <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
            )}
          </Box>
        </Box>
      </Shell>

      {/* Status Banner */}
      {hasContent && (
        <Alert
          severity="success"
          icon={<CheckCircleOutline fontSize="inherit" />}
          sx={{ mt: 1.5, py: 0.5, borderRadius: TOKEN.radius, fontFamily: TOKEN.fontSans, fontSize: '0.8rem' }}
        >
          Answer recorded.{uploadedImage ? ' Image uploaded.' : ''} {textValue ? ' Written answer saved.' : ''}
        </Alert>
      )}
    </Box>
  );
};

export default ImageAnswer;
