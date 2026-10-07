import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch,
  FormControlLabel, MenuItem, InputAdornment, Chip, Stack, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddLoginIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import RemoveLoginIcon from '@mui/icons-material/PersonRemoveOutlined';
import { supabase, fetchAll } from './supabase';
import { line } from '../theme';
import { offices } from '../config';
import { Panel, PageTitle } from './ui';

const COLS = { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) 120px 90px 100px 112px' };
// Phones: name and actions on one line, details full width below. Desktop: figures in columns beside the name.
const AREAS = { xs: '"name actions" "contact contact" "stats stats"', md: '"name charge split cust actions" "contact . . . ."' };
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

// Calls the admin-users server function; returns an error message, or null on success.
async function adminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  // functions.invoke puts the JSON body of non-2xx replies on error.context
  if (error) return (await error.context?.json?.().catch(() => null))?.error ?? error.message;
  return data?.error ?? null;
}

// Login details to hand over privately, with a one-tap copy.
function ShareDetails({ email, password }) {
  const [copied, setCopied] = useState(false);
  const text = `Exit partner portal\n${window.location.href.split('#')[0]}\nEmail: ${email}\nTemporary password: ${password}`;
  return (
    <Box sx={{ border: `1px solid ${line}`, borderRadius: 1.5, p: 2 }}>
      <Typography sx={{ overflowWrap: 'anywhere' }}>Login page: {window.location.href.split('#')[0]}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }}>Email: {email}</Typography>
      <Typography>Temporary password: <strong>{password}</strong></Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}>
        {copied ? 'Copied' : 'Copy details'}
      </Button>
    </Box>
  );
}

function PasswordDialog({ login, onClose }) {
  const [password, setPassword] = useState(tempPassword());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function save() {
    setBusy(true);
    const problem = await adminUsers({ action: 'set_password', user_id: login.id, password });
    setBusy(false);
    if (problem) return setError(problem);
    setDone(true);
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Set a new password for {login.full_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {done ? (
            <>
              <Alert severity="success">Password changed. Share these details privately; they can change it again from their Account page.</Alert>
              <ShareDetails email={login.email} password={password} />
            </>
          ) : (
            <>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography color="text.secondary">Their old password stops working straight away.</Typography>
              <TextField label="New temporary password" value={password} onChange={(e) => setPassword(e.target.value)} helperText="At least 8 characters." autoFocus />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {done ? <Button variant="contained" onClick={onClose}>Done</Button> : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" disabled={busy || password.length < 8} onClick={save}>Set password</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// Confirms a removal; `run` returns an error message or null.
function ConfirmDialog({ title, children, action, run, onClose, onDone }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    const problem = await run();
    setBusy(false);
    if (problem) return setError(problem);
    onDone();
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography>{children}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" disabled={busy} onClick={confirm}>{action}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Secondary details separated by dots; on narrow screens they wrap between items, never mid-item.
function Inline({ items, empty, sx }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1, color: 'text.secondary', fontSize: 14, ...sx }}>
      {items.length === 0 && empty}
      {items.map((t, i) => (
        <Box component="span" key={t} sx={{ overflowWrap: 'anywhere', '&::after': i < items.length - 1 ? { content: '"·"', ml: 1 } : undefined }}>{t}</Box>
      ))}
    </Box>
  );
}

// Small icon button; the tooltip doubles as its accessible name.
function Act({ label, icon: Icon, onClick, danger }) {
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} onClick={onClick} sx={{ color: danger ? 'error.main' : 'text.secondary' }}>
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

// One login: name and email on a line, actions at the end. `extra` sits before the actions (staff office).
function LoginLine({ p, you, extra, onReset, onRemove, sx }) {
  return (
    <Box component="li" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, minHeight: 44, ...sx }}>
      <Box sx={{ minWidth: 0, flex: '1 1 200px', display: 'flex', flexWrap: 'wrap', columnGap: 1.25, alignItems: 'baseline' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{p.full_name}{you && ' (you)'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{p.email}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
        {extra}
        <Box sx={{ display: 'flex' }}>
        <Act label="Reset password" icon={KeyIcon} onClick={() => onReset(p)} />
          {!you && <Act label="Remove login" icon={RemoveLoginIcon} onClick={() => onRemove(p)} danger />}
        </Box>
      </Box>
    </Box>
  );
}

// Staff tied to an office see only that office's call-back requests; blank = all offices.
function OfficeSelect({ value, onChange, ...rest }) {
  return (
    <TextField select label="Office" value={value ?? ''} onChange={onChange} helperText="Which website call-back requests they see." {...rest}>
      <MenuItem value="">All offices</MenuItem>
      {offices.map((o) => <MenuItem key={o.city} value={o.city}>{o.city}</MenuItem>)}
    </TextField>
  );
}

function LoginDialog({ partner, onClose, onSaved }) {
  const [f, setF] = useState({ full_name: '', email: partner?.email ?? '', password: tempPassword(), role: partner ? 'franchisee' : 'employee', office: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    const problem = await adminUsers({ action: 'create', ...f, franchisee_id: partner?.id });
    setBusy(false);
    if (problem) return setError(problem);
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
            <ShareDetails email={f.email} password={f.password} />
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
            {f.role === 'employee' && <OfficeSelect value={f.office} onChange={set('office')} />}
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

export default function Partners({ email: myEmail }) {
  const [partners, setPartners] = useState(null);
  const [people, setPeople] = useState([]);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // partner object, {} for new
  const [loginFor, setLoginFor] = useState(null); // partner, or 'staff'
  const [passwordFor, setPasswordFor] = useState(null); // login
  const [removing, setRemoving] = useState(null); // login
  const [deleting, setDeleting] = useState(null); // partner

  function load() {
    Promise.all([
      fetchAll((o) => supabase.from('franchisees').select('*, franchisee_terms(hidden_charge_pct)', o).order('name').order('id')),
      fetchAll((o) => supabase.from('profiles').select('id, full_name, email, role, franchisee_id, office', o).order('full_name').order('id')),
      supabase.from('partner_customer_counts').select('*'),
    ]).then(([f, p, c]) => {
      const err = f.error ?? p.error ?? c.error;
      if (err) return setError(err.message);
      setPartners(f.data.map((x) => ({ ...x, hidden_charge_pct: x.franchisee_terms?.hidden_charge_pct ?? '' })));
      setPeople(p.data);
      setCounts(Object.fromEntries(c.data.map((r) => [r.franchisee_id, r.active_customers])));
    });
  }
  useEffect(load, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!partners) return null;
  const staffLogins = people.filter((p) => p.role !== 'franchisee');

  return (
    <>
      <PageTitle action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>Add partner</Button>}>
        Partners
      </PageTitle>

      <Panel title={`${partners.length} partners`}>
        {partners.length === 0 && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>Add your first partner to start onboarding customers.</Typography>}
        {partners.length > 0 && (
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: COLS, columnGap: 2, px: 3, py: 1.25, borderBottom: `1px solid ${line}` }}>
            {['Partner', 'Hidden charge', 'Split', 'Customers'].map((h) => (
              <Typography key={h} variant="body2" color="text.secondary" sx={{ textAlign: h === 'Partner' ? 'left' : 'right' }}>{h}</Typography>
            ))}
          </Box>
        )}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {partners.map((f) => {
            const logins = people.filter((p) => p.franchisee_id === f.id);
            const charge = f.hidden_charge_pct === '' ? 'Not set' : `${Number(f.hidden_charge_pct)}%`;
            const split = `${Number(f.profit_share_pct)} / ${100 - Number(f.profit_share_pct)}`;
            const customers = counts[f.id] ?? 0;
            return (
              <Box component="li" key={f.id} sx={{ px: { xs: 2, md: 3 }, py: 1.5, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: COLS, gridTemplateAreas: AREAS, columnGap: 2, alignItems: 'center' }}>
                  <Box sx={{ gridArea: 'name', minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{f.name}</Typography>
                    {!f.active && <Chip size="small" variant="outlined" label="Inactive" />}
                  </Box>
                  <Inline sx={{ gridArea: 'contact' }} items={[f.phone, f.email].filter(Boolean)} empty="No contact details" />
                  <Inline sx={{ gridArea: 'stats', display: { xs: 'flex', md: 'none' } }} items={[`${charge} charge`, `${split} split`, `${customers} customers`]} />
                  {[['charge', charge], ['split', split], ['cust', String(customers)]].map(([area, v]) => (
                    <Typography key={area} sx={{ gridArea: area, display: { xs: 'none', md: 'block' }, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
                  ))}
                  <Box sx={{ gridArea: 'actions', display: 'flex', justifyContent: 'flex-end' }}>
                    <Act label="Edit partner" icon={EditIcon} onClick={() => setEditing(f)} />
                    <Act label="Add login" icon={AddLoginIcon} onClick={() => setLoginFor(f)} />
                    {!customers && <Act label="Delete partner" icon={DeleteIcon} onClick={() => setDeleting(f)} danger />}
                  </Box>
                </Box>
                {logins.length > 0 && (
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1, p: 0, pl: 1.5, borderLeft: `2px solid ${line}` }}>
                    {logins.map((p) => <LoginLine key={p.id} p={p} onReset={setPasswordFor} onRemove={setRemoving} />)}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Panel>

      <Panel
        title={`${staffLogins.length} staff logins`}
        action={<Button size="small" startIcon={<AddIcon />} onClick={() => setLoginFor('staff')}>Add staff login</Button>}
        sx={{ mt: 4 }}
      >
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {staffLogins.map((p) => (
            <LoginLine
              key={p.id} p={p} you={p.email === myEmail} onReset={setPasswordFor} onRemove={setRemoving}
              sx={{ px: { xs: 2, md: 3 }, py: 1, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}
              extra={p.role === 'admin' ? <Typography variant="body2" color="text.secondary">Admin</Typography> : (
                <OfficeSelect
                  size="small" variant="standard" label={null} helperText={null} sx={{ width: 130 }}
                  slotProps={{ select: { displayEmpty: true, inputProps: { 'aria-label': `${p.full_name}'s office` } } }}
                  value={p.office}
                  onChange={async (e) => {
                    const { error } = await supabase.from('profiles').update({ office: e.target.value || null }).eq('id', p.id);
                    if (error) setError(error.message); else load();
                  }}
                />
              )}
            />
          ))}
        </Box>
      </Panel>

      {editing && <PartnerDialog partner={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {loginFor && <LoginDialog partner={loginFor === 'staff' ? null : loginFor} onClose={() => setLoginFor(null)} onSaved={load} />}
      {passwordFor && <PasswordDialog login={passwordFor} onClose={() => setPasswordFor(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.full_name}'s login?`}
          action="Remove login"
          run={() => adminUsers({ action: 'delete_login', user_id: removing.id })}
          onClose={() => setRemoving(null)}
          onDone={() => { setRemoving(null); load(); }}
        >
          {removing.email} will no longer be able to log in. Customers, results and the activity log they created stay as they are.
        </ConfirmDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          action="Delete partner"
          run={() => adminUsers({ action: 'delete_partner', franchisee_id: deleting.id })}
          onClose={() => setDeleting(null)}
          onDone={() => { setDeleting(null); load(); }}
        >
          Use this for a partner added by mistake. Its logins are removed too. A partner that already has customers or results can't be deleted; mark it inactive instead.
        </ConfirmDialog>
      )}
    </>
  );
}
