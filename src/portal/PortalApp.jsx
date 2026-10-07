import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/TodayOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonIcon from '@mui/icons-material/AccountCircleOutlined';
import { supabase } from './supabase';
import Login from './Login';
import Layout from './Layout';
import Dashboard from './Dashboard';
import Customers from './Customers';
import Customer from './Customer';
import Account from './Account';

const everyone = ['admin', 'employee', 'franchisee'];
// Pages by hash route (#/today). roles: who sees it in the nav. #/customers/<id> opens one customer.
const pages = [
  { path: 'today', label: 'Today', icon: TodayIcon, roles: everyone, Page: Dashboard },
  { path: 'customers', label: 'Customers', icon: PeopleIcon, roles: everyone, Page: Customers, Detail: Customer },
  { path: 'account', label: 'Account', icon: PersonIcon, roles: everyone, Page: Account },
];

function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
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
  const [path, id] = useRoute();

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
      .select('full_name, role, franchisee_id, franchisees(name, phone, email, exit_commission_pct, active)')
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
  const Page = (id && current.Detail) || current.Page;
  return (
    <Layout profile={profile} nav={nav} current={current.path}>
      <Page key={id} profile={profile} id={id} email={session.user.email} />
    </Layout>
  );
}
