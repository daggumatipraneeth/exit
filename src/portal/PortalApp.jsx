import { lazy, Suspense, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/TodayOutlined';
import MonthIcon from '@mui/icons-material/CalendarMonthOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonIcon from '@mui/icons-material/AccountCircleOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import HandshakeIcon from '@mui/icons-material/HandshakeOutlined';
import EventIcon from '@mui/icons-material/EventAvailableOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import PhoneIcon from '@mui/icons-material/PhoneInTalkOutlined';
import { supabase } from './supabase';
import { company } from '../config';
import Login from './Login';
import Layout from './Layout';
import Account, { PasswordPanel } from './Account'; // the password panel is needed before any page, so it stays in

// Pages load on first use, so a phone only downloads what that person opens. `load` warms a page ahead of time.
function page(load, name = 'default') {
  const get = () => load().then((m) => ({ default: m[name] }));
  return Object.assign(lazy(get), { load: get });
}
const Dashboard = page(() => import('./Dashboard'));
const MonthView = page(() => import('./MonthView'));
const DailyEntry = page(() => import('./DailyEntry'));
const Customers = page(() => import('./Customers'));
const Customer = page(() => import('./Customer'));
const NewCustomer = page(() => import('./Onboarding'), 'NewCustomer');
const Requests = page(() => import('./Requests'));
const Partners = page(() => import('./Partners'));
const PartnerDetail = page(() => import('./Partners'), 'PartnerDetail');
const Months = page(() => import('./Admin'), 'Months');
const Templates = page(() => import('./Admin'), 'Templates');
const Activity = page(() => import('./Admin'), 'Activity');
const Sign = page(() => import('./Sign'));
const MyAccount = page(() => import('./MyAccount'));

const everyone = ['admin', 'employee', 'franchisee'];
const staff = ['admin', 'employee'];
const admin = ['admin'];
// Pages by hash route (#/today), in nav order. roles: who can open it. #/customers/<id> opens one customer.
// Row-level security in the database is the real guard; this only decides what each role is shown.
const pages = [
  { path: 'today', label: 'Today', icon: TodayIcon, roles: everyone, Page: Dashboard },
  { path: 'month', label: 'Month', icon: MonthIcon, roles: everyone, Page: MonthView },
  { path: 'entry', label: 'Daily entry', short: 'Entry', icon: EditNoteIcon, roles: staff, Page: DailyEntry },
  { path: 'customers', label: 'Customers', icon: PeopleIcon, roles: everyone, Page: Customers, Detail: Customer },
  { path: 'requests', label: 'Requests', icon: PhoneIcon, roles: everyone, Page: Requests },
  { path: 'partners', label: 'Partners', icon: HandshakeIcon, roles: admin, Page: Partners, Detail: PartnerDetail },
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
const spinner = <Centered><CircularProgress aria-label="Loading" /></Centered>;
const pageSpinner = <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress aria-label="Loading" /></Box>;

export default function PortalApp() {
  if (!supabase) {
    return <Centered><Typography color="text.secondary">The partner portal isn't set up on this site yet.</Typography></Centered>;
  }
  return <Portal />;
}

function Portal() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(undefined);
  const [path, id] = useRoute();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setProfile(undefined);
    // Fetch the likely first page's code while the profile loads (customers get MyAccount, staff the page in the link).
    MyAccount.load();
    (pages.find((p) => p.path === path)?.Page ?? Dashboard).load();
    supabase
      .from('profiles')
      .select('full_name, role, franchisee_id, office, franchisees(name, phone, email, profit_share_pct, active)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [session?.user.id]);

  if (path === 'sign') return <Suspense fallback={spinner}><Sign key={id} token={id} /></Suspense>; // public: customers sign without a login; fresh state per link

  if (session === undefined || (session && profile === undefined)) {
    return spinner;
  }
  if (!session) return <Login key={path} partner={path === 'partner'} />;
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

  if (profile.role === 'franchisee' && !profile.franchisees?.active) {
    return (
      <Centered>
        <Box sx={{ maxWidth: 420, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>Your partner account is paused</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Call the Exit office on {company.phone} to turn it back on.</Typography>
          <Button variant="outlined" onClick={() => supabase.auth.signOut()}>Log out</Button>
        </Box>
      </Centered>
    );
  }

  // A temporary password from Exit is replaced before anything else.
  if (session.user.app_metadata?.must_change_password) {
    return <Centered><Box sx={{ width: '100%', maxWidth: 440 }}><PasswordPanel email={session.user.email} temporary /></Box></Centered>;
  }

  // Customers get one page and nothing else.
  if (profile.role === 'customer') {
    return <Layout profile={profile} nav={[]} current=""><Suspense fallback={pageSpinner}><MyAccount /></Suspense></Layout>;
  }

  const nav = pages.filter((p) => p.roles.includes(profile.role));
  const current = nav.find((p) => p.path === path) ?? nav[0];
  const Page = id === 'new' && current.path === 'customers' ? NewCustomer : (id && current.Detail) || current.Page;
  return (
    <Layout profile={profile} nav={nav} current={current.path}>
      <Suspense fallback={pageSpinner}><Page key={id} profile={profile} id={id} email={session.user.email} /></Suspense>
      <Prefetch pages={nav} />
    </Layout>
  );
}

// Once the first page is up, quietly fetch the person's other pages so moving around stays instant.
function Prefetch({ pages }) {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 1500));
    idle(() => pages.forEach((p) => { p.Page.load?.(); p.Detail?.load?.(); }));
  }, [pages.length]);
  return null;
}
