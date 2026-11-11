import { Box, Typography } from '@mui/material';

// Section title with an optional supporting line beneath it.
export default function SectionHeading({ title, subtitle }) {
  return (
    <Box sx={{ mb: { xs: 5, md: 8 } }}>
      <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', sm: '2.6rem', md: '3.25rem' } }}>{title}</Typography>
      {subtitle && (
        <Typography color="text.secondary" sx={{ mt: 2, fontSize: { xs: '1.05rem', md: '1.15rem' }, lineHeight: 1.7 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
