import { useState } from 'react';
import { Box, Fab, Tooltip, Typography, Button, IconButton, ClickAwayListener } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CallIcon from '@mui/icons-material/Call';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/EventAvailableOutlined';
import { AnimatePresence, m } from 'framer-motion';
import { company } from '../config';
import { accent, ink, navy } from '../theme';

const wa = '#25D366';
const tel = `tel:${company.phone.replace(/\s/g, '')}`;
const chatLink = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent('Hi Exit team, I would like to know more about your advisory services.')}`;

const pulse = {
  '&::after': {
    content: '""', position: 'absolute', inset: 0, borderRadius: '50%',
    border: `2px solid ${wa}`, animation: 'pulse 2.4s ease-out 3', willChange: 'transform, opacity', // finite on purpose: an endless pulse keeps phones busy
  },
  '@keyframes pulse': { from: { transform: 'scale(1)', opacity: 0.8 }, to: { transform: 'scale(1.7)', opacity: 0 } },
};

// WhatsApp-style preview window; "Start chat" hands off to WhatsApp itself.
function ChatWindow({ onClose }) {
  return (
    <Box
      component={m.div}
      role="dialog" aria-label="Chat with Exit on WhatsApp"
      initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: 'bottom right' }}
      sx={{
        position: 'fixed', zIndex: 1300, overflow: 'hidden', borderRadius: 4, bgcolor: '#fff', boxShadow: '0 30px 60px -20px rgba(10,24,48,.45)',
        right: { xs: 12, sm: 28 }, left: { xs: 12, sm: 'auto' }, width: { sm: 340 },
        bottom: { xs: 'calc(84px + env(safe-area-inset-bottom))', sm: 160 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, bgcolor: '#075E54', color: '#fff' }}>
        <Box sx={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', bgcolor: '#fff', display: 'grid', placeItems: 'center' }}>
          <Box component="img" src="media/Exit256.png" alt="" sx={{ width: 28 }} />
          <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: '50%', bgcolor: wa, border: '2px solid #075E54' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>Exit Advisory</Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>{company.phone}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close chat" sx={{ color: '#fff' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ p: 2, bgcolor: '#ECE5DD' }}>
        <Box sx={{ maxWidth: '85%', p: 1.5, borderRadius: '0 12px 12px 12px', bgcolor: '#fff', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            Namaste! 👋 Ask us anything about stocks, SIPs or your portfolio. An advisor will reply right here on WhatsApp.
          </Typography>
        </Box>
      </Box>
      <Box sx={{ p: 2 }}>
        <Button fullWidth variant="contained" href={chatLink} target="_blank" rel="noopener noreferrer" startIcon={<WhatsAppIcon />}
          sx={{ minHeight: 48, bgcolor: wa, color: ink, '&:hover': { bgcolor: '#1ebe5a' } }}>
          Start chat
        </Button>
      </Box>
    </Box>
  );
}

export default function FloatingActions() {
  const [chat, setChat] = useState(false);
  const toggle = () => setChat((c) => !c);
  const bar = { flex: 1, flexDirection: 'column', gap: 0.3, minHeight: 56, py: 0.8, borderRadius: 3, fontSize: 12, color: ink, '& .MuiButton-startIcon': { m: 0 } };

  return (
    <ClickAwayListener onClickAway={() => setChat(false)}>
      <Box>
        <AnimatePresence>{chat && <ChatWindow onClose={() => setChat(false)} />}</AnimatePresence>

        {/* Phones: a bottom action bar, always within thumb reach. */}
        <Box
          component={m.div}
          initial={{ y: 100 }} animate={{ y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}
          sx={{
            display: { xs: 'flex', sm: 'none' }, position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200, gap: 1,
            px: 1.5, pt: 1, pb: 'calc(8px + env(safe-area-inset-bottom))',
            bgcolor: 'rgba(255,255,255,.97)', borderTop: '1px solid rgba(18,40,74,.1)', boxShadow: '0 -12px 32px -20px rgba(10,24,48,.35)',
          }}
        >
          <Button href={tel} startIcon={<CallIcon />} sx={bar}>Call</Button>
          <Button onClick={toggle} startIcon={<WhatsAppIcon sx={{ color: '#128C4B' }} />} sx={bar}>WhatsApp</Button>
          <Button href="#contact" variant="contained" startIcon={<EventIcon />} sx={{ ...bar, flex: 1.4, color: '#fff', bgcolor: '#0B7A53' }}>Book a call</Button>
        </Box>

        {/* Larger screens: floating buttons. */}
        <Box
          component={m.div}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}
          sx={{ display: { xs: 'none', sm: 'flex' }, position: 'fixed', right: 28, bottom: 28, flexDirection: 'column', gap: 1.5, zIndex: 1200 }}
        >
          <Tooltip title={`Call ${company.phone}`} placement="left">
            <Fab size="medium" href={tel} aria-label="Call Exit" sx={{ alignSelf: 'center', bgcolor: navy, color: '#fff', '&:hover': { bgcolor: '#1c3a66' } }}>
              <CallIcon />
            </Fab>
          </Tooltip>
          <Tooltip title="Chat on WhatsApp" placement="left">
            <Fab onClick={toggle} aria-label="Chat on WhatsApp" aria-expanded={chat}
              sx={{ bgcolor: chat ? accent : wa, color: '#fff', position: 'relative', overflow: 'visible', '&:hover': { bgcolor: '#1ebe5a' }, ...pulse }}>
              {chat ? <CloseIcon /> : <WhatsAppIcon />}
            </Fab>
          </Tooltip>
        </Box>
      </Box>
    </ClickAwayListener>
  );
}
