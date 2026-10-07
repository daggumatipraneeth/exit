import { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Stack } from '@mui/material';
import { supabase } from './supabase';
import { company } from '../config';
import { line } from '../theme';

// Passwords are set by an Exit admin (Partners page), who shares a temporary one; there's no self-service reset.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.status === 400 ? 'Email or password is incorrect.' : error.message);
    setBusy(false);
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 6 }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Box component="a" href="./" aria-label={`${company.short} home`} sx={{ display: 'inline-flex', mb: 5 }}>
          <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: 40 }} />
        </Box>
        <Box component="form" onSubmit={submit} noValidate sx={{ bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2, p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>Partner login</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>For Exit franchise partners and staff.</Typography>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" autoComplete="username" required autoFocus fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" autoComplete="current-password" required fullWidth value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="contained" size="large" disabled={busy || !email || !password}>Log in</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
            Forgot your password? Ask the Exit office to set a new one for you.
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Want to become a partner? Call {company.phone}.
        </Typography>
      </Box>
    </Box>
  );
}
