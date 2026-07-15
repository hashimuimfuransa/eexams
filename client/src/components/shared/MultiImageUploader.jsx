import { Box, Typography, IconButton } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { getImageUrl } from '../../utils/getImageUrl';

// Reusable multi-image attachment control for questions. Each entry in `images` is
// { file: File|null, url: string } — `url` is always something displayable (a base64
// preview while `file` is still pending upload, or the final hosted URL once uploaded).
// Images are stacked vertically edge-to-edge so a long document split into several
// screenshots (e.g. a multi-page trial balance) reads as one continuous image.
export default function MultiImageUploader({ images = [], onChange, label = 'Question Images (Optional)' }) {
  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ file, url: reader.result });
      reader.readAsDataURL(file);
    }))).then(newEntries => onChange([...images, ...newEntries]));
  };

  const removeAt = (i) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>{label}</Typography>
      {images.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.25 }}>
          {images.map((img, i) => (
            <Box key={i} sx={{ position: 'relative' }}>
              <Box
                component="img"
                src={getImageUrl(img.url)}
                alt={`Question image ${i + 1}`}
                sx={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 2, border: '1px solid #E2E8F0', display: 'block', bgcolor: '#F8FAFC' }}
              />
              <IconButton
                size="small"
                onClick={() => removeAt(i)}
                sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(239,68,68,0.92)', color: 'white', '&:hover': { bgcolor: '#EF4444' } }}
              >
                <Delete sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
      <Box
        component="label"
        sx={{
          border: '1px dashed #CBD5E1', borderRadius: 2, p: 2.5, textAlign: 'center', cursor: 'pointer', display: 'block',
          '&:hover': { borderColor: '#0CBD73', bgcolor: 'rgba(12,189,115,0.02)' }
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <Add sx={{ fontSize: 28, color: '#94A3B8', mb: 0.5 }} />
        <Typography sx={{ fontSize: 12.5, color: '#64748B' }}>
          {images.length > 0 ? 'Click to add more images' : 'Click to upload image(s)'}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#94A3B8', mt: 0.25 }}>
          PNG, JPG, GIF up to 10MB each. Add several for long documents or multiple transaction pages — they display stacked together.
        </Typography>
      </Box>
    </Box>
  );
}
