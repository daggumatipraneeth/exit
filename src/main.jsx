import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import base from './theme';
import App from './App';

// Landing page only: app-like pill buttons in Exit green. The portal keeps the base theme.
const theme = createTheme(base, {
  palette: { primary: { main: '#0B7A53', dark: '#086445', contrastText: '#fff' } },
  typography: {
    h1: { fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.04 },
    h2: { fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 },
    h3: { fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, paddingInline: 24, paddingBlock: 12 } },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 14 } } },
    // Broad layout: wide container with roomier gutters on big screens.
    MuiContainer: { styleOverrides: { root: { '@media (min-width: 900px)': { paddingInline: 40 }, '@media (min-width: 1200px)': { paddingInline: 64 } } } },
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Slim build of framer-motion: `m.*` components plus only the animation features the site uses. */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  </React.StrictMode>
);
