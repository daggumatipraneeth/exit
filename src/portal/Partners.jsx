import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch,
  FormControlLabel, MenuItem, InputAdornment, Chip, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { supabase } from './supabase';
import { line } from '../theme';
import { Panel, PageTitle } from './ui';

const blankPartner = { name: '', phone: '', email: '', hidden_charge_pct: '', profit_share_pct: 70, active: true };
const pctOk = (v) => v !== '' && Number(v) >= 0 && Number(v) <= 100;

// Readable temporary password; the person changes it from their Account page.
function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join('');
}

function PartnerDialog({ partner, onClose, onSaved }) {
  const [f, setF] = useState(partner ?? blankPartner);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim() && pctOk(f.hidden_charge_pct) && pctOk(f.profit_share_pct);

  async function save() {
    const row = { name: f.name.trim(), phone: f.phone || null, email: f.email || null, profit_share_pct: Number(f.profit_share_pct), active: f.active };
    const saved = f.id
      ? await supabase.from('franchisees').update(row).eq('id', f.id).select('id').single()
      : await supabase.from('franchisees').insert(row).select('id').single();
    const before = partner?.hidden_charge_pct;
    const termsChanged = before == null || before === '' || Number(before) !== Number(f.hidden_charge_pct);
    const terms = saved.error || !termsChanged ? saved
      : await supabase.from('franchisee_terms').upsert({ franchisee_id: saved.data.id, hidden_charge_pct: Number(f.hidden_charge_pct) });
    if (terms.error) return setError(/franchisees_name_key/.test(terms.error.message) ? 'Another partner already has this name.' : terms.error.message);
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{f.id ? 'Edit partner' : 'Add partner'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Business name" required value={f.name} onChange={set('name')} autoFocus />
          <TextField label="Phone" value={f.phone ?? ''} onChange={set('phone')} type="tel" />
          <TextField label="Email" value={f.email ?? ''} onChange={set('email')} type="email" />
          <TextField
            label="Hidden charge" required type="number" value={f.hidden_charge_pct} onChange={set('hidden_charge_pct')}
            helperText="Taken from each profitable day before the partner sees it. Partners never see this. Changes apply to new days only."
            slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 }, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
          />
          <TextField
            label="Partner's profit share" required type="number" value={f.profit_share_pct} onChange={set('profit_share_pct')}
            helperText="Partner's share of profit once every customer bucket is full. Exit keeps the rest."
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 }, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
          />
          <FormControlLabel control={<Switch checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />} label="Active (inactive partners can't see anything)" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!valid} onClick={save}>{f.id ? 'Save partner' : 'Add partner'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function LoginDialog({ partner, onClose, onSaved }) {
  const [f, setF] = useState({ full_name: '', email: partner?.email ?? '', password: tempPassword(), role: partner ? 'franchisee' : 'employee' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', { body: { ...f, franchisee_id: partner?.id } });
    setBusy(false);
    // functions.invoke puts the JSON body of non-2xx replies on error.context
    if (error) return setError((await error.context?.json?.().catch(() => null))?.error ?? error.message);
    if (data?.error) return setError(data.error);
    setDone(true);
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{partner ? `Login for ${partner.name}` : 'Add staff login'}</DialogTitle>
      <DialogContent>
        {done ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="success">Login created. Share these details privately; they can change the password from their Account page.</Alert>
            <Box sx={{ border: `1px solid ${line}`, borderRadius: 1.5, p: 2, fontFeatureSettings: '"tnum"' }}>
              <Typography>Login page: {window.location.href.split('#')[0]}</Typography>
              <Typography>Email: {f.email}</Typography>
              <Typography>Temporary password: <strong>{f.password}</strong></Typography>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Person's name" required value={f.full_name} onChange={set('full_name')} autoFocus />
            <TextField label="Login email" required type="email" value={f.email} onChange={set('email')} />
            <TextField label="Temporary password" required value={f.password} onChange={set('password')} helperText="At least 8 characters. You'll see it once more after saving." />
            {!partner && (
              <TextField select label="Role" value={f.role} onChange={set('role')} helperText="Admins can also manage partners, months and the agreement.">
                <MenuItem value="employee">Exit staff</MenuItem>
                <MenuItem value="admin">Exit admin</MenuItem>
              </TextField>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {done ? <Button variant="contained" onClick={onClose}>Done</Button> : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" disabled={busy || !f.full_name.trim() || !f.email || f.password.length < 8} onClick={save}>Create login</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function Partners() {
  const [partners, setPartners] = useState(null);
  const [people, setPeople] = useState([]);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // partner object, {} for new
  const [loginFor, setLoginFor] = useState(null); // partner, or 'staff'

  function load() {
    Promise.all([
      supabase.from('franchisees').select('*, franchisee_terms(hidden_charge_pct)').order('name'),
      supabase.from('profiles').select('id, full_name, email, role, franchisee_id').order('full_name'),
      supabase.from('customers').select('franchisee_id').eq('status', 'active'),
    ]).then(([f, p, c]) => {
      const err = f.error ?? p.error ?? c.error;
      if (err) return setError(err.message);
      setPartners(f.data.map((x) => ({ ...x, hidden_charge_pct: x.franchisee_terms?.hidden_charge_pct ?? '' })));
      setPeople(p.data);
      setCounts(c.data.reduce((m, r) => ({ ...m, [r.franchisee_id]: (m[r.franchisee_id] ?? 0) + 1 }), {}));
    });
  }
  useEffect(load, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!partners) return null;
  const staff = people.filter((p) => p.role !== 'franchisee');

  return (
    <>
      <PageTitle action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>Add partner</Button>}>
        Partners
      </PageTitle>

      <Panel title={`${partners.length} partners`}>
        {partners.length === 0 && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>Add your first partner to start onboarding customers.</Typography>}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {partners.map((f) => {
            const logins = people.filter((p) => p.franchisee_id === f.id);
            return (
              <Box
                component="li"
                key={f.id}
                sx={{
                  display: 'grid', gap: { xs: 1.5, md: 3 }, alignItems: 'center', px: { xs: 2, md: 3 }, py: 2,
                  gridTemplateColumns: { xs: '1fr auto', md: '1.4fr 0.7fr 0.7fr 1.6fr auto' },
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{f.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{[f.phone, f.email].filter(Boolean).join(', ') || 'No contact details'}</Typography>
                </Box>
                <Box sx={{ justifySelf: { xs: 'end', md: 'start' } }}>
                  <Chip size="small" label={f.active ? 'Active' : 'Inactive'} color={f.active ? 'success' : 'default'} variant={f.active ? 'filled' : 'outlined'} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Hidden charge; split</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{f.hidden_charge_pct === '' ? 'Not set' : `${Number(f.hidden_charge_pct)}%`}; {Number(f.profit_share_pct)}/{100 - Number(f.profit_share_pct)}</Typography>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">{counts[f.id] ?? 0} active customers; logins</Typography>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>{logins.map((l) => l.email ?? l.full_name).join(', ') || 'None yet'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                  <Button size="small" variant="outlined" onClick={() => setEditing(f)}>Edit</Button>
                  <Button size="small" variant="outlined" onClick={() => setLoginFor(f)}>Add login</Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Panel>

      <Panel
        title="Exit staff logins"
        action={<Button size="small" startIcon={<AddIcon />} onClick={() => setLoginFor('staff')}>Add staff login</Button>}
        sx={{ mt: 4 }}
      >
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {staff.map((p) => (
            <Box component="li" key={p.id} sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, px: { xs: 2, md: 3 }, py: 1.5, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>{p.full_name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{p.email}</Typography>
              </Box>
              <Chip size="small" variant="outlined" label={p.role === 'admin' ? 'Admin' : 'Staff'} />
            </Box>
          ))}
        </Box>
      </Panel>

      {editing && <PartnerDialog partner={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {loginFor && <LoginDialog partner={loginFor === 'staff' ? null : loginFor} onClose={() => setLoginFor(null)} onSaved={load} />}
    </>
  );
}
