import { createTheme, responsiveFontSizes } from '@mui/material/styles';

export const navy = '#12284A';
export const ink = '#0A1830';
export const accent = '#0F9D6B';
export const accentSoft = '#A7E3C9';
export const accentBright = '#34D399'; // accent on dark backgrounds
export const bg = '#FFFFFF';
export const mist = '#F3F6F5'; // alternate light section background
export const display = '"Inter", system-ui, sans-serif';
// Partner portal
export const page = '#F3F6F9';
export const line = '#DCE3EC';
export const loss = '#C0392B';


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
      h1: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.08 },
      h2: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12 },
      h3: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.015em' },
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
          'html, body': { overflowX: 'clip' },
          'a, button': { WebkitTapHighlightColor: 'transparent' },
          '::selection': { background: accentSoft, color: ink },
          'h1, h2, h3, h4': { textWrap: 'balance' },
          p: { textWrap: 'pretty' },
          // iOS Safari gives date/month inputs a minimum width of their own and ignores width: 100%, so they can
          // stick out of their box and make the whole page pan sideways.
          'input[type="date"], input[type="month"]': { minWidth: 0, maxWidth: '100%', WebkitAppearance: 'none' },
          // No focus outline anywhere (requested); MUI's own focus styles (input borders, button highlight) still show.
          '*:focus, *:focus-visible': { outline: 'none' },
          '@media (prefers-reduced-motion: reduce)': {
            html: { scrollBehavior: 'auto' },
            '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
    },
  })
);
