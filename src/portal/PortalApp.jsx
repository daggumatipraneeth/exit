import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/TodayOutlined';
import { supabase } from './supabase';
import Login from './Login';
import Layout from './Layout';
import Dashboard from './Dashboard';

// Pages by hash route (#/today). roles: who sees it in the nav.
const pages = [
  { path: 'today', label: 'Today', icon: TodayIcon, roles: ['admin', 'employee', 'franchisee'], Page: Dashboard },
];

function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/');
}

function Centered({ children }) {
  return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>{children}</Box>;
}

export default function PortalApp() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [recovering, setRecovering] = useState(false);
  const [profile, setProfile] = useState(undefined);
  const [path] = useRoute();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setProfile(undefined);
    supabase
      .from('profiles')
      .select('full_name, role, franchisee_id, franchisees(name)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [session?.user.id]);

  if (session === undefined || (session && profile === undefined && !recovering)) {
    return <Centered><CircularProgress aria-label="Loading" /></Centered>;
  }
  if (!session || recovering) return <Login key={String(recovering)} recovering={recovering} onRecovered={() => setRecovering(false)} />;
  if (!profile) {
    return (
      <Centered>
        <Box sx={{ maxWidth: 420, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>This login isn't linked to a partner account</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Ask the Exit office to set up access for {session.user.email}.
          </Typography>
          <Button variant="outlined" onClick={() => supabase.auth.signOut()}>Log out</Button>
        </Box>
      </Centered>
    );
  }

  const nav = pages.filter((p) => p.roles.includes(profile.role));
  const current = nav.find((p) => p.path === path) ?? nav[0];
  return (
    <Layout profile={profile} nav={nav} current={current.path}>
      <current.Page profile={profile} />
    </Layout>
  );
}
