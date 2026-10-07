import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { supabase } from './supabase';
import { company } from '../config';
import { Panel, Field } from './ui';

const roleName = { admin: 'Exit admin', employee: 'Exit staff', franchisee: 'Franchise partner' };

export default function Account({ profile, email }) {
  const f = profile.franchisees;
  const [pw, setPw] = useState({ next: '', again: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const mismatch = pw.again && pw.next !== pw.again;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setMsg(error ? ['error', error.message] : ['success', 'Password changed.']);
    if (!error) setPw({ next: '', again: '' });
    setBusy(false);
  }

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: { xs: '1.6rem', md: '2.1rem' }, mb: 3 }}>
        Account
      </Typography>
      <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1fr 1fr' }, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 } }}>
          <Panel title="You">
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', px: { xs: 2, md: 3 }, py: 2.5 }}>
              <Field label="Name">{profile.full_name}</Field>
              <Field label="Role">{roleName[profile.role]}</Field>
              <Box sx={{ gridColumn: '1 / -1' }}><Field label="Login email">{email}</Field></Box>
            </Box>
          </Panel>

          {f && (
            <Panel title="Partnership">
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', px: { xs: 2, md: 3 }, py: 2.5 }}>
                <Box sx={{ gridColumn: '1 / -1' }}><Field label="Business name">{f.name}</Field></Box>
                <Field label="Phone">{f.phone}</Field>
                <Field label="Email">{f.email}</Field>
                <Field label="Your profit share">{`${Number(f.profit_share_pct)}% once every customer bucket is full`}</Field>
                <Field label="Status">{f.active ? 'Active' : 'Inactive'}</Field>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 2, md: 3 }, pb: 2.5 }}>
                To change these details, call the Exit office on {company.phone}.
              </Typography>
            </Panel>
          )}
        </Box>

        <Panel title="Change password">
          <Box component="form" onSubmit={save} sx={{ display: 'grid', gap: 2, px: { xs: 2, md: 3 }, py: 2.5 }}>
            {msg && <Alert severity={msg[0]}>{msg[1]}</Alert>}
            <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
            <TextField
              label="New password" type="password" autoComplete="new-password" value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })} helperText="At least 8 characters."
            />
            <TextField
              label="Repeat new password" type="password" autoComplete="new-password" value={pw.again}
              onChange={(e) => setPw({ ...pw, again: e.target.value })}
              error={!!mismatch} helperText={mismatch ? "Passwords don't match." : ' '}
            />
            <Button type="submit" variant="contained" disabled={busy || pw.next.length < 8 || pw.next !== pw.again} sx={{ justifySelf: 'start' }}>
              Change password
            </Button>
          </Box>
        </Panel>
      </Box>
    </>
  );
}
