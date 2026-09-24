import { Box, Typography } from '@mui/material';
import Reveal from './Reveal';
import { accent, accentBright } from '../theme';

export default function SectionHeading({ overline, title, subtitle, light, align = 'center' }) {
  return (
    <Reveal>
      <Box sx={{ textAlign: align, maxWidth: 720, mx: align === 'center' ? 'auto' : 0, mb: { xs: 5, md: 8 } }}>
        <Typography variant="overline" sx={{ color: light ? accentBright : accent, display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="span" sx={{ width: 28, height: '1px', bgcolor: light ? accentBright : accent }} />
          {overline}
        </Typography>
        <Typography variant="h2" sx={{ mt: 1.5, color: light ? '#fff' : 'text.primary', fontSize: { xs: '2.1rem', md: '3rem' } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ mt: 2, color: light ? 'rgba(255,255,255,.72)' : 'text.secondary', fontSize: { md: '1.1rem' } }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Reveal>
  );
}
