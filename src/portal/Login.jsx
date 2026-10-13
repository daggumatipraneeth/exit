import { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Stack, Link } from '@mui/material';
import { supabase } from './supabase';
import { company } from '../config';
import { line } from '../theme';

// Two login pages, one form. Customers (#/) sign in with their mobile number, stored as the login email
// <mobile>@customer.exit; partners and staff (#/partner) with their email. Passwords are set for them; there's no self-service reset.
const mobile10 = (v) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');

const pages = {
  customer: {
    title: 'Customer login',
    field: { label: 'Mobile number', type: 'tel', inputMode: 'numeric', helperText: '10 digits, e.g. 9848012345' },
    toEmail: (v) => `${mobile10(v)}@customer.exit`,
    ready: (v) => mobile10(v).length === 10,
    wrong: 'Mobile number or password is incorrect.',
    forgot: 'Forgot your password? Ask your partner to reset it.',
    other: ['Partner login', '#/partner'],
  },
  partner: {
    title: 'Partner login',
    field: { label: 'Email', type: 'email', inputMode: 'email' },
    toEmail: (v) => v.trim(),
    ready: (v) => v.includes('@'),
    wrong: 'Email or password is incorrect.',
    forgot: 'Forgot your password? Ask the Exit office to set a new one.',
    other: ['Customer login', '#/'],
  },
};

export default function Login({ partner }) {
  const page = pages[partner ? 'partner' : 'customer'];
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: page.toEmail(id), password });
    if (error) setError(error.status === 400 ? page.wrong : error.message);
    setBusy(false);
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 6 }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Box component="form" key={page.title} onSubmit={submit} noValidate sx={{ bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2, p: { xs: 3, sm: 4 } }}>
          <Box component="a" href="./" aria-label={`${company.short} home`} sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: 40 }} />
          </Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>{page.title}</Typography>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label={page.field.label} type={page.field.type} helperText={page.field.helperText}
              autoComplete="username" required autoFocus fullWidth value={id} onChange={(e) => setId(e.target.value)}
              slotProps={{ htmlInput: { inputMode: page.field.inputMode } }}
            />
            <TextField label="Password" type="password" autoComplete="current-password" required fullWidth value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="contained" size="large" disabled={busy || !page.ready(id) || !password}>Log in</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>{page.forgot}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            For registration or account issues, contact support on{' '}
            <Link href={`tel:${company.phone.replace(/\s/g, '')}`} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{company.phone}</Link>.
          </Typography>
          <Typography variant="body2" sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${line}`, textAlign: 'center' }}>
            <Link href={page.other[1]} onClick={() => setError('')} sx={{ fontWeight: 600 }}>{page.other[0]}</Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
