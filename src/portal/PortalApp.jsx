import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/TodayOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonIcon from '@mui/icons-material/AccountCircleOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import HandshakeIcon from '@mui/icons-material/HandshakeOutlined';
import EventIcon from '@mui/icons-material/EventAvailableOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import { supabase } from './supabase';
import Login from './Login';
import Layout from './Layout';
import Dashboard from './Dashboard';
import Customers from './Customers';
import Customer from './Customer';
import Account from './Account';
import DailyEntry from './DailyEntry';
import Partners from './Partners';
import Sign from './Sign';
import { NewCustomer } from './Onboarding';
import { Months, Templates, Activity } from './Admin';

const everyone = ['admin', 'employee', 'franchisee'];
const staff = ['admin', 'employee'];
const admin = ['admin'];
// Pages by hash route (#/today), in nav order. roles: who can open it. #/customers/<id> opens one customer.
// Row-level security in the database is the real guard; this only decides what each role is shown.
const pages = [
  { path: 'today', label: 'Today', icon: TodayIcon, roles: everyone, Page: Dashboard },
  { path: 'entry', label: 'Daily entry', short: 'Entry', icon: EditNoteIcon, roles: staff, Page: DailyEntry },
  { path: 'customers', label: 'Customers', icon: PeopleIcon, roles: everyone, Page: Customers, Detail: Customer },
  { path: 'partners', label: 'Partners', icon: HandshakeIcon, roles: admin, Page: Partners },
  { path: 'months', label: 'Months', icon: EventIcon, roles: admin, Page: Months },
  { path: 'agreement', label: 'Agreement', icon: ArticleIcon, roles: admin, Page: Templates },
  { path: 'activity', label: 'Activity', icon: HistoryIcon, roles: admin, Page: Activity },
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
  if (!supabase) {
    return <Centered><Typography color="text.secondary">The partner portal isn't set up on this site yet.</Typography></Centered>;
  }
  return <Portal />;
}

function Portal() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [recovering, setRecovering] = useState(false);
  const [profile, setProfile] = useState(undefined);
  const [path, id] = useRoute();

  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    // Password reset link: ?token_hash=...&type=recovery (see supabase/templates/recovery.html)
    const q = new URLSearchParams(window.location.search);
    if (q.get('type') === 'recovery' && q.get('token_hash')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      supabase.auth.verifyOtp({ token_hash: q.get('token_hash'), type: 'recovery' }).then(({ error }) => {
        if (error) setLinkError('This reset link has expired or was already used. Ask for a new one below.');
        else setRecovering(true);
      });
    }
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
      .select('full_name, role, franchisee_id, franchisees(name, phone, email, profit_share_pct, active)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [session?.user.id]);

  if (path === 'sign') return <Sign token={id} />; // public: customers sign without a login

  if (session === undefined || (session && profile === undefined && !recovering)) {
    return <Centered><CircularProgress aria-label="Loading" /></Centered>;
  }
  if (!session || recovering) return <Login key={`${recovering}${linkError}`} recovering={recovering} linkError={linkError} onRecovered={() => setRecovering(false)} />;
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
  const Page = id === 'new' && current.path === 'customers' ? NewCustomer : (id && current.Detail) || current.Page;
  return (
    <Layout profile={profile} nav={nav} current={current.path}>
      <Page key={id} profile={profile} id={id} email={session.user.email} />
    </Layout>
  );
}
