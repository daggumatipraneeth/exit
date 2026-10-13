import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { supabase } from './supabase';
import { company } from '../config';
import { Panel, Field, PageTitle, phoneText } from './ui';

const roleName = { admin: 'Exit admin', employee: 'Exit staff', franchisee: 'Franchise partner' };

// Also used on the customer's page. temporary: the first login with a password Exit handed out, which was
// typed seconds ago, so the current password isn't asked again.
export function PasswordPanel({ email, temporary = false }) {
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const mismatch = pw.again && pw.next !== pw.again;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const wrong = !temporary && (await supabase.auth.signInWithPassword({ email, password: pw.current })).error;
    const { error } = wrong ? {} : await supabase.auth.updateUser({ password: pw.next });
    if (!wrong && !error) {
      await supabase.rpc('password_changed');
      if (temporary) await supabase.auth.refreshSession(); // the new session no longer carries the temporary mark
    }
    setMsg(wrong ? ['error', 'Your current password is wrong.'] : error ? ['error', error.message] : ['success', 'Password changed.']);
    if (!wrong && !error) setPw({ current: '', next: '', again: '' });
    setBusy(false);
  }

  return (
    <Panel title={temporary ? 'Choose your own password' : 'Change password'}>
      <Box component="form" onSubmit={save} sx={{ display: 'grid', gap: 2, px: { xs: 2, md: 3 }, py: 2.5 }}>
        {temporary && <Typography color="text.secondary">You logged in with a temporary password. Choose your own to continue.</Typography>}
        {msg && <Alert severity={msg[0]}>{msg[1]}</Alert>}
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        {!temporary && (
          <TextField
            label="Current password" type="password" autoComplete="current-password" value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        )}
        <TextField
          label="New password" type="password" autoComplete="new-password" value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })} helperText="At least 8 characters."
        />
        <TextField
          label="Repeat new password" type="password" autoComplete="new-password" value={pw.again}
          onChange={(e) => setPw({ ...pw, again: e.target.value })}
          error={!!mismatch} helperText={mismatch ? "Passwords don't match." : ' '}
        />
        <Button type="submit" variant="contained" disabled={busy || (!temporary && !pw.current) || pw.next.length < 8 || pw.next !== pw.again} sx={{ justifySelf: { xs: 'stretch', sm: 'end' } }}>
          Change password
        </Button>
      </Box>
    </Panel>
  );
}

export default function Account({ profile, email }) {
  const f = profile.franchisees;

  return (
    <>
      <PageTitle>Account</PageTitle>
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
                <Field label="Phone">{phoneText(f.phone)}</Field>
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

        <PasswordPanel email={email} />
      </Box>
    </>
  );
}
