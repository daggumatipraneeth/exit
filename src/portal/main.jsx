import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import base, { page, loss } from '../theme';
import PortalApp from './PortalApp';

const theme = createTheme(base, {
  palette: { background: { default: page }, error: { main: loss } },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontFeatureSettings: '"tnum"' } } },
    // One height per size, matching the inputs beside them: 40px, and 32px for size="small".
    MuiButton: {
      styleOverrides: {
        root: {
          paddingBlock: 8,
          '&.MuiButton-outlined': { paddingBlock: 7 },
          '&.MuiButton-sizeSmall': { paddingBlock: 4, paddingInline: 14, fontSize: 13.5 },
          '&.MuiButton-outlined.MuiButton-sizeSmall': { paddingBlock: 3 },
        },
      },
    },
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PortalApp />
    </ThemeProvider>
  </React.StrictMode>
);
