import { createTheme, responsiveFontSizes } from '@mui/material/styles';

export const navy = '#12284A';
export const ink = '#0A1830';
export const accent = '#0F9D6B';
export const accentSoft = '#A7E3C9';
export const accentBright = '#34D399'; // accent on dark backgrounds
export const bg = '#FFFFFF';


export default responsiveFontSizes(
  createTheme({
    palette: {
      primary: { main: navy, dark: ink, contrastText: '#fff' },
      secondary: { main: accent, light: accentSoft, contrastText: ink },
      background: { default: bg, paper: '#FFFFFF' },
      text: { primary: ink, secondary: '#4A5670' },
      success: { main: '#0F9D6B' },
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: '"Inter", system-ui, sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05 },
      h2: { fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12 },
      h3: { fontWeight: 700, letterSpacing: '-0.025em' },
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      overline: { fontWeight: 600, letterSpacing: '0.18em' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 24, paddingBlock: 11 },
        },
      },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiCssBaseline: {
        styleOverrides: {
          html: { scrollBehavior: 'smooth' },
          body: { overflowX: 'hidden' },
          '::selection': { background: accentSoft, color: ink },
          '@media (prefers-reduced-motion: reduce)': {
            html: { scrollBehavior: 'auto' },
            '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
    },
  })
);
