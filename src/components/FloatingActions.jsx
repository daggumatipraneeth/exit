import { Box, Fab, Tooltip } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CallIcon from '@mui/icons-material/Call';
import { motion } from 'framer-motion';
import { company } from '../config';
import { navy } from '../theme';

const pulse = {
  '&::after': {
    content: '""', position: 'absolute', inset: 0, borderRadius: '50%',
    border: '2px solid #25D366', animation: 'pulse 2.4s ease-out 3', willChange: 'transform, opacity', // finite on purpose: an endless pulse keeps phones busy

  },
  '@keyframes pulse': { from: { transform: 'scale(1)', opacity: 0.8 }, to: { transform: 'scale(1.7)', opacity: 0 } },
};

export default function FloatingActions() {
  const msg = encodeURIComponent('Hi Exit team, I would like to know more about your advisory services.');
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      sx={{ position: 'fixed', right: { xs: 16, md: 28 }, bottom: { xs: 16, md: 28 }, display: 'flex', flexDirection: 'column', gap: 1.5, zIndex: 1200 }}
    >
      <Tooltip title="Call us" placement="left">
        <Fab size="medium" href={`tel:${company.phone.replace(/\s/g, '')}`} aria-label="Call Exit" sx={{ bgcolor: navy, color: '#fff', '&:hover': { bgcolor: '#1c3a66' } }}>
          <CallIcon />
        </Fab>
      </Tooltip>
      <Tooltip title="Chat on WhatsApp" placement="left">
        <Fab
          href={`https://wa.me/${company.whatsapp}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          sx={{ bgcolor: '#25D366', color: '#fff', position: 'relative', overflow: 'visible', '&:hover': { bgcolor: '#1ebe5a' }, ...pulse }}
        >
          <WhatsAppIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
}
