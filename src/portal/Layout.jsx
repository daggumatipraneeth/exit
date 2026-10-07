import { useState } from 'react';
import { AppBar, Toolbar, Box, Button, Container, Typography, BottomNavigation, BottomNavigationAction, Paper, Menu, MenuItem, ListItemIcon } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import MoreIcon from '@mui/icons-material/MoreHoriz';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { supabase } from './supabase';
import { accent, ink, line } from '../theme';

const roleLabel = { admin: 'Exit admin', employee: 'Exit staff' };

// First n items shown, the rest go under "More". Keeps n slots in total.
const split = (nav, n) => (nav.length <= n ? [nav, []] : [nav.slice(0, n - 1), nav.slice(n - 1)]);

function MoreMenu({ items, current, anchor, onClose }) {
  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose}>
      {items.map((p) => (
        <MenuItem key={p.path} component="a" href={`#/${p.path}`} onClick={onClose} selected={p.path === current}>
          <ListItemIcon><p.icon fontSize="small" /></ListItemIcon>
          {p.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

export default function Layout({ profile, nav, current, children }) {
  const who = profile.franchisees?.name ?? roleLabel[profile.role];
  const [deskMain, deskMore] = split(nav, 6);
  const [phoneMain, phoneMore] = split(nav, 4);
  const [anchor, setAnchor] = useState(null);
  const [moreItems, setMoreItems] = useState([]);
  const openMore = (items) => (e) => { setMoreItems(items); setAnchor(e.currentTarget); };
  const inMore = (items) => items.some((p) => p.path === current);

  const tab = (active) => ({
    borderRadius: 0, px: 1.5, fontWeight: 500, whiteSpace: 'nowrap', transition: 'none',
    boxShadow: active ? `inset 0 -2px 0 ${accent}` : 'none',
    '&:hover': { bgcolor: 'transparent', boxShadow: `inset 0 -2px 0 ${active ? accent : line}` },
  });

  return (
    <Box sx={{ minHeight: '100dvh', pb: { xs: 9, md: 0 } }}>
      <AppBar elevation={0} position="sticky" sx={{ bgcolor: '#fff', color: ink, borderBottom: `1px solid ${line}` }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 3, minHeight: { xs: 60, md: 68 } }}>
            <Box component="a" href="#/" aria-label="Partner portal home" sx={{ display: 'flex', flexShrink: 0 }}>
              <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: { xs: 30, md: 34 } }} />
            </Box>
            <Box component="nav" aria-label="Portal" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, alignSelf: 'stretch' }}>
              {deskMain.map((p) => (
                <Button key={p.path} href={`#/${p.path}`} color="inherit" aria-current={p.path === current ? 'page' : undefined} sx={tab(p.path === current)}>
                  {p.label}
                </Button>
              ))}
              {deskMore.length > 0 && (
                <Button color="inherit" endIcon={<ExpandMore />} onClick={openMore(deskMore)} sx={tab(inMore(deskMore))}>More</Button>
              )}
            </Box>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ textAlign: 'right', minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{profile.full_name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">{who}</Typography>
            </Box>
            <Button
              color="inherit"
              onClick={() => supabase.auth.signOut()}
              startIcon={<LogoutIcon fontSize="small" />}
              aria-label="Log out"
              sx={{ px: { xs: 1, sm: 2 }, minWidth: 0, flexShrink: 0, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Log out</Box>
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        {children}
      </Container>

      <Paper square elevation={0} sx={{ display: { md: 'none' }, position: 'fixed', zIndex: 10, bottom: 0, left: 0, right: 0, borderTop: `1px solid ${line}`, pb: 'env(safe-area-inset-bottom)' }}>
        <BottomNavigation showLabels value={inMore(phoneMore) ? 'more' : current} sx={{ '& .Mui-selected': { color: accent } }}>
          {phoneMain.map((p) => (
            <BottomNavigationAction key={p.path} value={p.path} label={p.short ?? p.label} icon={<p.icon />} href={`#/${p.path}`} sx={{ minWidth: 0 }} />
          ))}
          {phoneMore.length > 0 && (
            <BottomNavigationAction value="more" label="More" icon={<MoreIcon />} onClick={openMore(phoneMore)} sx={{ minWidth: 0 }} />
          )}
        </BottomNavigation>
      </Paper>

      <MoreMenu items={moreItems} current={current} anchor={anchor} onClose={() => setAnchor(null)} />
    </Box>
  );
}
