import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import base, { page, loss } from '../theme';
import PortalApp from './PortalApp';

const theme = createTheme(base, {
  palette: { background: { default: page }, error: { main: loss } },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontFeatureSettings: '"tnum"' } } },
    MuiButton: { styleOverrides: { root: { paddingBlock: 9 } } },
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
