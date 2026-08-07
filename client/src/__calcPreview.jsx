import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Box, Button, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { CalculatorDialog, DraggableCalculator } from './components/ScientificCalculator';

const theme = createTheme({ palette: { mode: 'light' } });

const App = () => {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
      <Button id="toolbar" variant="contained" onClick={() => setOpen(p => !p)}>Calculator</Button>
      <Button id="dialogbtn" variant="outlined" onClick={() => setDialog(true)}>Dialog</Button>
      <Box id="state" sx={{ fontFamily: 'monospace' }}>{`open=${open} dialog=${dialog}`}</Box>
      <DraggableCalculator open={open} onClose={() => setOpen(false)} />
      <CalculatorDialog open={dialog} onClose={() => setDialog(false)} />
    </Box>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={theme}><CssBaseline /><App /></ThemeProvider>
);
