import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { animate, motion, useInView } from 'framer-motion';
import { stats } from '../config';

function CountUp({ value, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const fmt = (v) => `${prefix}${Math.round(v).toLocaleString('en-IN')}${suffix}`;
  useEffect(() => {
    if (!inView) return;
    // write text directly instead of re-rendering React every frame
    const c = animate(0, value, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { ref.current.textContent = fmt(v); } });
    return () => c.stop();
  }, [inView, value]);
  return <span ref={ref}>{fmt(0)}</span>;
}

// Highlights bar shown at the bottom of the hero.
export default function Stats() {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, rowGap: 3, py: { xs: 3, md: 3.5 },
        bgcolor: 'rgba(255,255,255,.94)', borderRadius: 4,
        border: '1px solid rgba(18,40,74,.08)', boxShadow: '0 24px 48px -32px rgba(18,40,74,.35)',
      }}
    >
      {stats.map((s, i) => (
        <Box key={s.label} sx={{ px: { xs: 2, md: 4 }, borderLeft: { xs: i % 2 ? '1px solid rgba(18,40,74,.08)' : 'none', md: i ? '1px solid rgba(18,40,74,.08)' : 'none' } }}>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 26, md: 34 }, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: 'primary.main' }}>
            <CountUp {...s} />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: 12.5, md: 14 } }}>{s.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
