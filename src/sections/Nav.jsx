import { useState } from 'react';
import { AppBar, Toolbar, Box, Button, IconButton, Drawer, List, ListItemButton, ListItemText, Container, useScrollTrigger } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { accent, ink } from '../theme';

export const links = [
  ['Services', '#services'],
  ['Why Exit', '#why'],
  ['SIP Calculator', '#calculator'],
  ['Risk Profile', '#risk'],
  ['Offices', '#offices'],
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 24 });

  return (
    <AppBar
      elevation={0}
      sx={{
        top: 3,
        bgcolor: scrolled ? 'rgba(255,255,255,.8)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(180%) blur(16px)' : 'none',
        borderBottom: '1px solid',
        borderColor: scrolled ? 'rgba(18,40,74,.08)' : 'transparent',
        transition: 'all .4s ease',
        color: ink,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ height: scrolled ? 68 : 84, transition: 'height .4s ease' }}>
          <Box component="a" href="#top" sx={{ display: 'flex' }} aria-label="Exit home">
            <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: { xs: 36, md: 42 } }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, mr: 2 }}>
            {links.map(([label, href]) => (
              <Button
                key={href}
                href={href}
                color="inherit"
                sx={{
                  position: 'relative', fontWeight: 500, px: 1.6,
                  '&::after': {
                    content: '""', position: 'absolute', left: 16, right: 16, bottom: 8, height: '1px',
                    bgcolor: accent, transform: 'scaleX(0)', transformOrigin: 'right', transition: 'transform .35s ease',
                  },
                  '&:hover': { bgcolor: 'transparent' },
                  '&:hover::after': { transform: 'scaleX(1)', transformOrigin: 'left' },
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
          <Button variant="contained" href="#contact" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            Book consultation
          </Button>
          <IconButton sx={{ display: { md: 'none' }, ml: 1 }} onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: '82vw', maxWidth: 340, bgcolor: ink, color: '#fff' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5 }}>
          <IconButton onClick={() => setOpen(false)} sx={{ color: '#fff' }} aria-label="Close menu"><CloseIcon /></IconButton>
        </Box>
        <List sx={{ px: 2 }}>
          {[...links, ['Contact', '#contact']].map(([label, href]) => (
            <ListItemButton key={href} component="a" href={href} onClick={() => setOpen(false)} sx={{ borderBottom: '1px solid rgba(255,255,255,.08)', py: 2 }}>
              <ListItemText primary={label} primaryTypographyProps={{ fontSize: 22 }} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ p: 3, mt: 'auto' }}>
          <Button fullWidth variant="contained" color="secondary" href="#contact" onClick={() => setOpen(false)}>
            Book consultation
          </Button>
        </Box>
      </Drawer>
    </AppBar>
  );
}
