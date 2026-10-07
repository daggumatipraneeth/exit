import { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Link, Stack } from '@mui/material';
import { supabase } from './supabase';
import { company } from '../config';
import { line } from '../theme';

// Three modes: log in, ask for a reset link, and set a new password after following that link.
export default function Login({ recovering, linkError, onRecovered }) {
  const [mode, setMode] = useState(recovering ? 'reset' : linkError ? 'forgot' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(linkError ?? '');
  const [notice, setNotice] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.status === 400 ? 'Email or password is incorrect.' : error.message);
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
      if (error) setError(error.message);
      else setNotice(`If ${email} has a partner account, a reset link is on its way.`);
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(error.message);
      else onRecovered();
    }
    setBusy(false);
  }

  const copy = {
    login: ['Partner login', 'For Exit franchise partners and staff.', 'Log in'],
    forgot: ['Reset your password', "Enter your login email and we'll send you a reset link.", 'Send reset link'],
    reset: ['Choose a new password', 'Use at least 8 characters.', 'Save password'],
  }[mode];

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 6 }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Box component="a" href="./" aria-label={`${company.short} home`} sx={{ display: 'inline-flex', mb: 5 }}>
          <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: 40 }} />
        </Box>
        <Box component="form" onSubmit={submit} noValidate sx={{ bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2, p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>{copy[0]}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{copy[1]}</Typography>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {notice && <Alert severity="success">{notice}</Alert>}
            {mode !== 'reset' && (
              <TextField label="Email" type="email" autoComplete="username" required autoFocus fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
            {mode !== 'forgot' && (
              <TextField
                label={mode === 'reset' ? 'New password' : 'Password'}
                type="password"
                autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{ htmlInput: { minLength: mode === 'reset' ? 8 : undefined } }}
              />
            )}
            <Button type="submit" variant="contained" size="large" disabled={busy || (mode === 'reset' ? password.length < 8 : !email)}>
              {copy[2]}
            </Button>
          </Stack>
          {mode !== 'reset' && (
            <Typography variant="body2" sx={{ mt: 2.5 }}>
              <Link component="button" type="button" sx={{ minHeight: 40 }} onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); setNotice(''); }}>
                {mode === 'login' ? 'Forgot password?' : 'Back to login'}
              </Link>
            </Typography>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Want to become a partner? Call {company.phone}.
        </Typography>
      </Box>
    </Box>
  );
}
