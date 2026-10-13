import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import theme from './theme';
import App from './App';

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
