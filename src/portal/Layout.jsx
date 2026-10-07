import { AppBar, Toolbar, Box, Button, Container, Typography, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { supabase } from './supabase';
import { accent, ink, line } from '../theme';

const roleLabel = { admin: 'Exit admin', employee: 'Exit staff' };

export default function Layout({ profile, nav, current, children }) {
  const who = profile.franchisees?.name ?? roleLabel[profile.role];
  const showNav = nav.length > 1;

  return (
    <Box sx={{ minHeight: '100dvh', pb: showNav ? { xs: 9, md: 0 } : 0 }}>
      <AppBar elevation={0} position="sticky" sx={{ bgcolor: '#fff', color: ink, borderBottom: `1px solid ${line}` }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 3, minHeight: { xs: 60, md: 68 } }}>
            <Box component="a" href="#/" aria-label="Partner portal home" sx={{ display: 'flex' }}>
              <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: { xs: 30, md: 34 } }} />
            </Box>
            {showNav && (
              <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, alignSelf: 'stretch' }}>
                {nav.map((p) => (
                  <Button
                    key={p.path}
                    href={`#/${p.path}`}
                    color="inherit"
                    aria-current={p.path === current ? 'page' : undefined}
                    sx={{
                      borderRadius: 0, px: 1.5, fontWeight: 500,
                      boxShadow: p.path === current ? `inset 0 -2px 0 ${accent}` : 'none',
                      '&:hover': { bgcolor: 'transparent', boxShadow: `inset 0 -2px 0 ${line}` },
                      '&[aria-current]:hover': { boxShadow: `inset 0 -2px 0 ${accent}` },
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </Box>
            )}
            <Box sx={{ flex: 1 }} />
            <Box sx={{ textAlign: 'right', minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{profile.full_name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">{who}</Typography>
            </Box>
            <Button
              color="inherit"
              onClick={() => supabase.auth.signOut()}
              startIcon={<LogoutIcon fontSize="small" />}
              sx={{ px: { xs: 1, sm: 2 }, minWidth: 0, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Log out</Box>
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        {children}
      </Container>

      {showNav && (
        <Paper square elevation={0} sx={{ display: { md: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: `1px solid ${line}`, pb: 'env(safe-area-inset-bottom)' }}>
          <BottomNavigation showLabels value={current} sx={{ '& .Mui-selected': { color: accent } }}>
            {nav.map((p) => (
              <BottomNavigationAction key={p.path} value={p.path} label={p.label} icon={<p.icon />} href={`#/${p.path}`} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
