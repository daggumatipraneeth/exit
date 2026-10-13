import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch,
  FormControlLabel, MenuItem, InputAdornment, Stack, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddLoginIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import RemoveLoginIcon from '@mui/icons-material/PersonRemoveOutlined';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { supabase, fetchAll } from './supabase';
import { line } from '../theme';
import { offices } from '../config';
import { Panel, PageTitle, Pill, Inline, Field, BackLink, tableHead, tableRow, rowLink, phoneText } from './ui';

// Partner list: one row each; everything else is on the partner's own page (#/partners/<id>).
const COLS = { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1.4fr) minmax(0, 1.6fr) 110px 90px 24px' };
const blankPartner = { name: '', phone: '', email: '', hidden_charge_pct: '', profit_share_pct: 70, active: true };
const pctOk = (v) => v !== '' && Number(v) >= 0 && Number(v) <= 100;

// Readable temporary password; the person changes it from their Account page.
export function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join('');
}

function PartnerDialog({ partner, onClose, onSaved }) {
  const [f, setF] = useState(partner ?? blankPartner);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim() && pctOk(f.hidden_charge_pct) && pctOk(f.profit_share_pct);
  const badPct = (v) => v !== '' && !pctOk(v); // empty is just not filled in yet
  const outOfRange = 'Enter a number from 0 to 100.';

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
            label="Hidden charge" required type="number" value={f.hidden_charge_pct} onChange={set('hidden_charge_pct')} error={badPct(f.hidden_charge_pct)}
            helperText={badPct(f.hidden_charge_pct) ? outOfRange : 'Taken from each profitable day before the partner sees it. Partners never see this. Changes apply to new days only.'}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 }, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
          />
          <TextField
            label="Partner's profit share" required type="number" value={f.profit_share_pct} onChange={set('profit_share_pct')} error={badPct(f.profit_share_pct)}
            helperText={badPct(f.profit_share_pct) ? outOfRange : "Partner's share of profit once every customer bucket is full. Exit keeps the rest."}
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
export async function adminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  // functions.invoke puts the JSON body of non-2xx replies on error.context
  if (error) return (await error.context?.json?.().catch(() => null))?.error ?? error.message;
  return data?.error ?? null;
}

// Login details to hand over privately, with a one-tap copy.
export function ShareDetails({ email, password, label = 'Email', title = 'Exit partner portal', login = '#/partner' }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.href.split('#')[0]}${login}`;
  const text = `${title}\n${url}\n${label}: ${email}\nTemporary password: ${password}`;
  return (
    <Box sx={{ border: `1px solid ${line}`, borderRadius: 1.5, p: 2 }}>
      <Typography sx={{ overflowWrap: 'anywhere' }}>Login page: {url}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }}>{label}: {email}</Typography>
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
function LoginLine({ p, you, extra, onReset, onRemove, onOffice, sx }) {
  return (
    <Box component="li" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, minHeight: 36, ...sx }}>
      <Box sx={{ minWidth: 0, flex: '1 1 200px', display: 'flex', flexWrap: 'wrap', columnGap: 1.25, alignItems: 'baseline' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{p.full_name}{you && ' (you)'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{p.email}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
        {extra}
        <Box sx={{ display: 'flex' }}>
          {onOffice && <Act label="Change office" icon={EditIcon} onClick={() => onOffice(p)} />}
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

// Change which office's call-back requests a staff login sees.
function OfficeDialog({ login, onClose, onSaved }) {
  const [office, setOffice] = useState(login.office ?? '');
  const [error, setError] = useState('');
  async function save() {
    const { error } = await supabase.from('profiles').update({ office: office || null }).eq('id', login.id);
    if (error) return setError(error.message);
    onSaved();
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{login.full_name}'s office</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <OfficeSelect value={office} onChange={(e) => setOffice(e.target.value)} autoFocus />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Save</Button>
      </DialogActions>
    </Dialog>
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

// Login dialogs shared by the list (staff logins) and a partner's page (their logins).
function LoginDialogs({ passwordFor, setPasswordFor, removing, setRemoving, officeFor, setOfficeFor, onChanged }) {
  return (
    <>
      {passwordFor && <PasswordDialog login={passwordFor} onClose={() => setPasswordFor(null)} />}
      {officeFor && <OfficeDialog login={officeFor} onClose={() => setOfficeFor(null)} onSaved={() => { setOfficeFor(null); onChanged(); }} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.full_name}'s login?`}
          action="Remove login"
          run={() => adminUsers({ action: 'delete_login', user_id: removing.id })}
          onClose={() => setRemoving(null)}
          onDone={() => { setRemoving(null); onChanged(); }}
        >
          {removing.email} will no longer be able to log in. Customers, results and the activity log they created stay as they are.
        </ConfirmDialog>
      )}
    </>
  );
}

export default function Partners({ email: myEmail }) {
  const [partners, setPartners] = useState(null);
  const [people, setPeople] = useState([]);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [staffLogin, setStaffLogin] = useState(false);
  const [passwordFor, setPasswordFor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [officeFor, setOfficeFor] = useState(null);

  function load() {
    Promise.all([
      fetchAll((o) => supabase.from('franchisees').select('id, name, phone, email, active', o).order('name').order('id')),
      fetchAll((o) => supabase.from('profiles').select('id, full_name, email, role, franchisee_id, office', o).order('full_name').order('id')),
      supabase.from('partner_customer_counts').select('*'),
    ]).then(([f, p, c]) => {
      const err = f.error ?? p.error ?? c.error;
      if (err) return setError(err.message);
      setPartners(f.data);
      setPeople(p.data);
      setCounts(Object.fromEntries(c.data.map((r) => [r.franchisee_id, r.active_customers])));
    });
  }
  useEffect(load, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!partners) return null;
  const staffLogins = people.filter((p) => !['franchisee', 'customer'].includes(p.role));

  return (
    <>
      <PageTitle action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add partner</Button>}>
        Partners
      </PageTitle>

      <Panel title={`${partners.length} partners`}>
        {partners.length === 0 && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>Add your first partner to start onboarding customers.</Typography>}
        {partners.length > 0 && (
          <Box aria-hidden sx={{ ...tableHead, gridTemplateColumns: COLS.md, columnGap: 2 }}>
            <span>Partner</span><span>Contact</span><Box sx={{ textAlign: 'right' }}>Customers</Box><Box sx={{ textAlign: 'right' }}>Logins</Box><span />
          </Box>
        )}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {partners.map((f) => {
            const logins = people.filter((p) => p.franchisee_id === f.id).length;
            const customers = counts[f.id] ?? 0;
            return (
              <Box component="li" key={f.id} sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                <Box component="a" href={`#/partners/${f.id}`} sx={{ ...rowLink, ...tableRow, gridTemplateColumns: COLS, columnGap: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{f.name}</Typography>
                      {!f.active && <Pill label="Inactive" />}
                    </Box>
                    <Inline sx={{ display: { md: 'none' }, fontSize: 13.5 }} items={[`${customers} customers`, `${logins} ${logins === 1 ? 'login' : 'logins'}`]} />
                  </Box>
                  <Inline sx={{ display: { xs: 'none', md: 'flex' } }} items={[phoneText(f.phone), f.email].filter(Boolean)} empty="No contact details" />
                  <Typography sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{customers}</Typography>
                  <Typography sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{logins}</Typography>
                  <ChevronRight sx={{ color: 'text.secondary', justifySelf: 'end' }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Panel>

      <Panel
        title={`${staffLogins.length} staff logins`}
        action={<Button size="small" startIcon={<AddIcon />} onClick={() => setStaffLogin(true)}>Add staff login</Button>}
        sx={{ mt: { xs: 3, md: 4 } }}
      >
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {staffLogins.map((p) => (
            <LoginLine
              key={p.id} p={p} you={p.email === myEmail} onReset={setPasswordFor} onRemove={setRemoving}
              sx={{ ...tableRow, py: { xs: 1, md: 0.75 }, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}
              extra={
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {p.role === 'admin' ? 'Admin' : p.office ? `${p.office} office` : 'All offices'}
                </Typography>
              }
              onOffice={p.role === 'employee' ? setOfficeFor : null}
            />
          ))}
        </Box>
      </Panel>

      {adding && <PartnerDialog partner={null} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {staffLogin && <LoginDialog partner={null} onClose={() => setStaffLogin(false)} onSaved={load} />}
      <LoginDialogs {...{ passwordFor, setPasswordFor, removing, setRemoving, officeFor, setOfficeFor }} onChanged={load} />
    </>
  );
}

// One partner: terms and contact, their logins, and the less common actions.
export function PartnerDetail({ id }) {
  const [f, setF] = useState(null);
  const [logins, setLogins] = useState([]);
  const [customers, setCustomers] = useState(0);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [addLogin, setAddLogin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passwordFor, setPasswordFor] = useState(null);
  const [removing, setRemoving] = useState(null);

  function load() {
    Promise.all([
      supabase.from('franchisees').select('*, franchisee_terms(hidden_charge_pct)').eq('id', id).maybeSingle(),
      supabase.from('profiles').select('id, full_name, email, role, franchisee_id').eq('franchisee_id', id).order('full_name'),
      supabase.from('partner_customer_counts').select('*').eq('franchisee_id', id).maybeSingle(),
    ]).then(([p, l, c]) => {
      const err = p.error ?? l.error ?? c.error;
      if (err) return setError(err.message);
      if (!p.data) return setError('This partner does not exist.');
      setF({ ...p.data, hidden_charge_pct: p.data.franchisee_terms?.hidden_charge_pct ?? '' });
      setLogins(l.data);
      setCustomers(c.data?.active_customers ?? 0);
    });
  }
  useEffect(load, [id]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!f) return null;
  const share = Number(f.profit_share_pct);

  return (
    <>
      <BackLink href="#/partners">All partners</BackLink>
      <PageTitle action={<Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {f.name} {!f.active && <Pill label="Inactive" />}
        </Box>
      </PageTitle>

      <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Panel title="Details">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', px: { xs: 2, md: 3 }, py: 2.5 }}>
            <Field label="Phone">{phoneText(f.phone)}</Field>
            <Field label="Email">{f.email}</Field>
            <Field label="Hidden charge">{f.hidden_charge_pct === '' ? 'Not set' : `${Number(f.hidden_charge_pct)}% of profitable days`}</Field>
            <Field label="Profit split">{`${share}% partner / ${100 - share}% Exit`}</Field>
            <Field label="Active customers">{String(customers)}</Field>
            <Field label="Status">{f.active ? 'Active' : 'Inactive (sees nothing)'}</Field>
          </Box>
        </Panel>

        <Panel title="Logins" action={<Button size="small" startIcon={<AddLoginIcon />} onClick={() => setAddLogin(true)}>Add login</Button>}>
          {logins.length === 0 && <Typography color="text.secondary" sx={{ px: { xs: 2, md: 3 }, py: 3 }}>No logins yet. Add one so the partner can see their customers.</Typography>}
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {logins.map((p) => (
              <LoginLine
                key={p.id} p={p} onReset={setPasswordFor} onRemove={setRemoving}
                sx={{ ...tableRow, py: { xs: 1, md: 0.75 }, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}
              />
            ))}
          </Box>
        </Panel>
      </Box>

      {customers === 0 && (
        <Box sx={{ mt: 3 }}>
          <Button color="error" startIcon={<DeleteIcon />} onClick={() => setDeleting(true)}>Delete partner</Button>
          <Typography variant="body2" color="text.secondary">Only for a partner added by mistake, with no customers or results.</Typography>
        </Box>
      )}

      {editing && <PartnerDialog partner={f} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {addLogin && <LoginDialog partner={f} onClose={() => setAddLogin(false)} onSaved={load} />}
      <LoginDialogs {...{ passwordFor, setPasswordFor, removing, setRemoving }} onChanged={load} />
      {deleting && (
        <ConfirmDialog
          title={`Delete ${f.name}?`}
          action="Delete partner"
          run={() => adminUsers({ action: 'delete_partner', franchisee_id: f.id })}
          onClose={() => setDeleting(false)}
          onDone={() => { window.location.hash = '#/partners'; }}
        >
          Use this for a partner added by mistake. Its logins are removed too. A partner that already has customers or results can't be deleted; mark it inactive instead.
        </ConfirmDialog>
      )}
    </>
  );
}
