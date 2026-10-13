import { useState } from 'react';
import { AppBar, Toolbar, Box, Button, Container, Typography, BottomNavigation, BottomNavigationAction, Paper, Menu, MenuItem, ListItemIcon, Avatar, Divider } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import MoreIcon from '@mui/icons-material/MoreHoriz';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HelpIcon from '@mui/icons-material/HelpOutlineOutlined';
import { supabase } from './supabase';
import Help from './Help';
import { accent, ink, line } from '../theme';

const roleLabel = { admin: 'Exit admin', employee: 'Exit staff', customer: 'Customer' };

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

// One button for the person: initials (and name on desktop); the menu holds who they are, Help and Log out.
function UserMenu({ profile, who }) {
  const [anchor, setAnchor] = useState(null);
  const [help, setHelp] = useState(false);
  const initials = profile.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  return (
    <>
      <Button
        color="inherit" onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account menu" aria-haspopup="menu"
        endIcon={<ExpandMore sx={{ display: { xs: 'none', md: 'block' } }} />}
        sx={{ minWidth: 44, minHeight: 44, px: { xs: 0.5, md: 1 }, gap: 1, borderRadius: 999, flexShrink: 0, textTransform: 'none', '& .MuiButton-endIcon': { ml: 0 } }}
      >
        <Avatar sx={{ width: 34, height: 34, fontSize: 14, fontWeight: 600, bgcolor: ink }}>{initials}</Avatar>
        <Box component="span" sx={{ display: { xs: 'none', md: 'inline' }, fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile.full_name}
        </Box>
      </Button>
      <Menu
        anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}
        disableRestoreFocus // focus would go back to the button just as the Help drawer hides the page behind it
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>{profile.full_name}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{who}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); setHelp(true); }}>
          <ListItemIcon><HelpIcon fontSize="small" /></ListItemIcon>Help
        </MenuItem>
        <MenuItem onClick={() => supabase.auth.signOut()}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Log out
        </MenuItem>
      </Menu>
      <Help role={profile.role} open={help} onClose={() => setHelp(false)} />
    </>
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
    borderRadius: 0, px: 1.5, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', transition: 'none', color: active ? accent : 'inherit',
    boxShadow: active ? `inset 0 -2px 0 ${accent}` : 'none',
    '&:hover': { bgcolor: 'transparent', boxShadow: `inset 0 -2px 0 ${active ? accent : line}` },
  });

  return (
    <Box sx={{ minHeight: '100dvh', pb: { xs: nav.length ? 9 : 0, md: 0 } }}>
      <AppBar elevation={0} position="sticky" sx={{ bgcolor: '#fff', color: ink, borderBottom: `1px solid ${line}` }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 3, minHeight: { xs: 60, md: 68 } }}>
            <Box component="a" href="#/" aria-label="Partner portal home" sx={{ display: 'flex', alignItems: 'center', minHeight: 44, flexShrink: 0 }}>
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
            <UserMenu profile={profile} who={who} />
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="xl" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        {children}
      </Container>

      <Paper square elevation={0} sx={{ display: { xs: nav.length ? 'block' : 'none', md: 'none' }, position: 'fixed', zIndex: 10, bottom: 0, left: 0, right: 0, borderTop: `1px solid ${line}`, pb: 'env(safe-area-inset-bottom)' }}>
        <BottomNavigation showLabels value={inMore(phoneMore) ? 'more' : current} sx={{ '& .MuiBottomNavigationAction-root.Mui-selected': { color: accent } }}>
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
