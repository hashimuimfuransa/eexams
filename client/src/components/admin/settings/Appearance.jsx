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
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Slider,
  Card,
  CardContent,
  CardActionArea,
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Palette as PaletteIcon,
  FormatSize as FormatSizeIcon,
  ViewCompact as ViewCompactIcon,
  Brush as BrushIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Appearance = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for appearance settings
  const [settings, setSettings] = useState({
    theme: 'light',
    primaryColor: 'blue',
    borderRadius: 8,
    fontSize: 16,
    density: 'comfortable',
    sidebarStyle: 'expanded',
    cardStyle: 'elevated',
    tableView: 'default'
  });

  // State for save notification
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle settings change
  const handleSettingChange = (event) => {
    const { name, value, checked } = event.target;
    setSettings({
      ...settings,
      [name]: event.target.type === 'checkbox' ? checked : value
    });
  };

  // Handle slider change
  const handleSliderChange = (name) => (event, newValue) => {
    setSettings({
      ...settings,
      [name]: newValue
    });
  };

  // Handle color selection
  const handleColorSelect = (color) => {
    setSettings({
      ...settings,
      primaryColor: color
    });
  };

  // Handle save settings
  const handleSaveSettings = () => {
    // In a real app, this would save settings to the backend
    console.log('Saving appearance settings:', settings);
    setSaveSuccess(true);
  };

  // Handle close snackbar
  const handleCloseSnackbar = () => {
    setSaveSuccess(false);
  };

  // Handle reset to defaults
  const handleResetDefaults = () => {
    setSettings({
      theme: 'light',
      primaryColor: 'blue',
      borderRadius: 8,
      fontSize: 16,
      density: 'comfortable',
      sidebarStyle: 'expanded',
      cardStyle: 'elevated',
      tableView: 'default'
    });
  };

  // Color options
  const colorOptions = [
    { name: 'blue', color: '#1976d2' },
    { name: 'purple', color: '#9c27b0' },
    { name: 'green', color: '#2e7d32' },
    { name: 'orange', color: '#ed6c02' },
    { name: 'red', color: '#d32f2f' },
    { name: 'teal', color: '#009688' }
  ];

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
            Appearance Settings
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Customize the look and feel of your dashboard
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/settings/system')}
          sx={{
            borderRadius: 3,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Back to Settings
        </Button>
      </Box>

      {/* Theme settings */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          p: { xs: 2, md: 3 },
          mb: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PaletteIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6" fontWeight="medium">
            Theme Settings
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* Theme Mode */}
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
                Theme Mode
              </FormLabel>
              <RadioGroup
                row
                name="theme"
                value={settings.theme}
                onChange={handleSettingChange}
              >
                <FormControlLabel
                  value="light"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LightModeIcon sx={{ mr: 0.5 }} />
                      <Typography>Light</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="dark"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DarkModeIcon sx={{ mr: 0.5 }} />
                      <Typography>Dark</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="system"
                  control={<Radio />}
                  label="System Default"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Primary Color */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              Primary Color
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {colorOptions.map((option) => (
                <Tooltip key={option.name} title={option.name.charAt(0).toUpperCase() + option.name.slice(1)}>
                  <Box
                    onClick={() => handleColorSelect(option.name)}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: option.color,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: settings.primaryColor === option.name
                        ? `2px solid ${theme.palette.common.white}`
                        : 'none',
                      boxShadow: settings.primaryColor === option.name
                        ? `0 0 0 2px ${option.color}, 0 0 0 4px ${alpha(option.color, 0.3)}`
                        : `0 2px 4px ${alpha(theme.palette.common.black, 0.2)}`
                    }}
                  >
                    {settings.primaryColor === option.name && (
                      <CheckIcon sx={{ color: '#fff' }} />
                    )}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Grid>

          {/* Border Radius */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              Border Radius
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={settings.borderRadius}
                onChange={handleSliderChange('borderRadius')}
                aria-labelledby="border-radius-slider"
                valueLabelDisplay="auto"
                step={2}
                marks={[
                  { value: 0, label: '0px' },
                  { value: 8, label: '8px' },
                  { value: 16, label: '16px' },
                  { value: 24, label: '24px' }
                ]}
                min={0}
                max={24}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Paper
                elevation={0}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 0,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                }}
              />
              <Paper
                elevation={0}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                }}
              />
              <Paper
                elevation={0}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 4,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                }}
              />
              <Paper
                elevation={0}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 6,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                }}
              />
            </Box>
          </Grid>

          {/* Font Size */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              Font Size
              <FormatSizeIcon sx={{ ml: 1, fontSize: '1.2rem' }} />
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={settings.fontSize}
                onChange={handleSliderChange('fontSize')}
                aria-labelledby="font-size-slider"
                valueLabelDisplay="auto"
                step={1}
                marks={[
                  { value: 14, label: 'Small' },
                  { value: 16, label: 'Medium' },
                  { value: 18, label: 'Large' }
                ]}
                min={14}
                max={18}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontSize: 14 }}>
                Small Text
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 16 }}>
                Medium Text
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 18 }}>
                Large Text
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Layout settings */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          p: { xs: 2, md: 3 },
          mb: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ViewCompactIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6" fontWeight="medium">
            Layout Settings
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* Density */}
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
                Interface Density
              </FormLabel>
              <RadioGroup
                row
                name="density"
                value={settings.density}
                onChange={handleSettingChange}
              >
                <FormControlLabel value="compact" control={<Radio />} label="Compact" />
                <FormControlLabel value="comfortable" control={<Radio />} label="Comfortable" />
                <FormControlLabel value="spacious" control={<Radio />} label="Spacious" />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Sidebar Style */}
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
                Sidebar Style
              </FormLabel>
              <RadioGroup
                row
                name="sidebarStyle"
                value={settings.sidebarStyle}
                onChange={handleSettingChange}
              >
                <FormControlLabel value="expanded" control={<Radio />} label="Expanded" />
                <FormControlLabel value="compact" control={<Radio />} label="Compact" />
                <FormControlLabel value="mini" control={<Radio />} label="Mini" />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Card Style */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              Card Style
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    border: settings.cardStyle === 'outlined'
                      ? `2px solid ${theme.palette.primary.main}`
                      : `1px solid ${alpha(theme.palette.divider, 0.2)}`
                  }}
                >
                  <CardActionArea onClick={() => handleSettingChange({ target: { name: 'cardStyle', value: 'outlined' } })}>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <BrushIcon sx={{ mb: 1, color: theme.palette.text.secondary }} />
                      <Typography variant="body2">Outlined</Typography>
                      {settings.cardStyle === 'outlined' && (
                        <CheckIcon
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: theme.palette.primary.main
                          }}
                        />
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card
                  elevation={3}
                  sx={{
                    borderRadius: 2,
                    border: settings.cardStyle === 'elevated'
                      ? `2px solid ${theme.palette.primary.main}`
                      : 'none'
                  }}
                >
                  <CardActionArea onClick={() => handleSettingChange({ target: { name: 'cardStyle', value: 'elevated' } })}>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <BrushIcon sx={{ mb: 1, color: theme.palette.text.secondary }} />
                      <Typography variant="body2">Elevated</Typography>
                      {settings.cardStyle === 'elevated' && (
                        <CheckIcon
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: theme.palette.primary.main
                          }}
                        />
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Table View */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              Table View
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Card
                  variant={settings.cardStyle === 'outlined' ? 'outlined' : 'elevation'}
                  elevation={settings.cardStyle === 'elevated' ? 3 : 0}
                  sx={{
                    borderRadius: 2,
                    border: settings.tableView === 'default'
                      ? `2px solid ${theme.palette.primary.main}`
                      : settings.cardStyle === 'outlined'
                        ? `1px solid ${alpha(theme.palette.divider, 0.2)}`
                        : 'none'
                  }}
                >
                  <CardActionArea onClick={() => handleSettingChange({ target: { name: 'tableView', value: 'default' } })}>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <ViewListIcon sx={{ mb: 1, color: theme.palette.text.secondary }} />
                      <Typography variant="body2">Default</Typography>
                      {settings.tableView === 'default' && (
                        <CheckIcon
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: theme.palette.primary.main
                          }}
                        />
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card
                  variant={settings.cardStyle === 'outlined' ? 'outlined' : 'elevation'}
                  elevation={settings.cardStyle === 'elevated' ? 3 : 0}
                  sx={{
                    borderRadius: 2,
                    border: settings.tableView === 'card'
                      ? `2px solid ${theme.palette.primary.main}`
                      : settings.cardStyle === 'outlined'
                        ? `1px solid ${alpha(theme.palette.divider, 0.2)}`
                        : 'none'
                  }}
                >
                  <CardActionArea onClick={() => handleSettingChange({ target: { name: 'tableView', value: 'card' } })}>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <GridViewIcon sx={{ mb: 1, color: theme.palette.text.secondary }} />
                      <Typography variant="body2">Card View</Typography>
                      {settings.tableView === 'card' && (
                        <CheckIcon
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: theme.palette.primary.main
                          }}
                        />
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Additional Options */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              Additional Options
            </Typography>
            <Box sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.animationsEnabled}
                    onChange={handleSettingChange}
                    name="animationsEnabled"
                    color="primary"
                  />
                }
                label="Enable animations"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showHelpTips}
                    onChange={handleSettingChange}
                    name="showHelpTips"
                    color="primary"
                  />
                }
                label="Show help tips"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Preview */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          p: { xs: 2, md: 3 },
          mb: 3,
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" fontWeight="medium" gutterBottom>
          Preview
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{
          p: 2,
          bgcolor: settings.theme === 'dark' ? '#121212' : '#f5f5f5',
          borderRadius: 2,
          border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
          position: 'relative'
        }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8
            }}
          >
            Preview not available in this version
          </Typography>

          <Box sx={{
            width: '100%',
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            opacity: 0.7
          }}>
            <InfoIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Theme preview will be available in a future update
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleResetDefaults}
          sx={{
            borderRadius: 3,
            px: 3,
            py: 1.2
          }}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.2,
            boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          Save Changes
        </Button>
      </Box>

      {/* Success snackbar */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%', borderRadius: 2 }}
        >
          Appearance settings saved successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Appearance;
