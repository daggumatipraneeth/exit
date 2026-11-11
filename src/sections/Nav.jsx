import { useState } from 'react';
import { AppBar, Toolbar, Box, Button, IconButton, Drawer, List, ListItemButton, ListItemText, Container, useScrollTrigger } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { ink } from '../theme';

export const links = [
  ['Services', '#services'],
  ['Why Exit', '#why'],
  ['SIP Calculator', '#calculator'],
  ['Risk Check', '#risk'],
  ['Offices', '#offices'],
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 24 });

  return (
    <AppBar
      elevation={0}
      sx={{
        top: 0, color: ink, bgcolor: scrolled ? '#fff' : 'transparent',
        borderBottom: '1px solid', borderColor: scrolled ? 'rgba(18,40,74,.1)' : 'transparent',
        transition: 'background-color .3s ease, border-color .3s ease',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ height: { xs: 64, md: 76 } }}>
          <Box component="a" href="#top" sx={{ display: 'flex' }} aria-label="Exit home">
            <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: { xs: 34, md: 40 } }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, mr: 2 }}>
            {links.map(([label, href]) => (
              <Button key={href} href={href} color="inherit" sx={{ fontWeight: 500, px: 1.5, '&:hover': { bgcolor: 'rgba(18,40,74,.05)' } }}>
                {label}
              </Button>
            ))}
          </Box>
          <Button color="inherit" href="portal.html" sx={{ display: { xs: 'none', sm: 'inline-flex' }, mr: 1, fontWeight: 500 }}>
            Login
          </Button>
          <Button variant="contained" href="#contact" sx={{ display: { xs: 'none', sm: 'inline-flex' }, py: 1 }}>
            Book consultation
          </Button>
          <IconButton sx={{ display: { md: 'none' }, ml: 1, color: ink }} onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} slotProps={{ paper: { sx: { width: '82vw', maxWidth: 340, display: 'flex', flexDirection: 'column' } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5 }}>
          <IconButton onClick={() => setOpen(false)} aria-label="Close menu"><CloseIcon /></IconButton>
        </Box>
        <List sx={{ px: 2 }}>
          {[...links, ['Contact', '#contact']].map(([label, href]) => (
            <ListItemButton key={href} component="a" href={href} onClick={() => setOpen(false)} sx={{ borderBottom: '1px solid rgba(18,40,74,.1)', py: 2 }}>
              <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: 20, fontWeight: 500, color: ink } } }} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ p: 3, mt: 'auto' }}>
          <Button fullWidth variant="contained" href="#contact" onClick={() => setOpen(false)}>Book consultation</Button>
          <Button fullWidth variant="outlined" href="portal.html" sx={{ mt: 1.5, borderColor: 'rgba(18,40,74,.25)' }}>Login</Button>
        </Box>
      </Drawer>
    </AppBar>
  );
}
