import { useEffect, useState } from 'react';
import { Box, Typography, Alert, Button, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Drawer, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRight from '@mui/icons-material/ChevronRight';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/MailOutlined';
import { supabase, fetchAll } from './supabase';
import { offices, interests } from '../config';
import { line } from '../theme';
import { Panel, PageTitle, FilterChips, ShowMore, PAGE_ROWS, errText, Pill, tableRow, rowLink, phoneText, IST } from './ui';

const statusLook = { new: ['New', 'attention'], contacted: ['Contacted', 'progress'], closed: ['Closed', 'neutral'] };
const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST });
const whatsapp = (phone) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`;

// One line per request in the list; tapping it opens the request on the side.
function RequestRow({ r, onOpen }) {
  const [label, tone] = statusLook[r.status];
  return (
    <Box component="li" sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
      <Box
        component="button" type="button" onClick={() => onOpen(r)}
        sx={{ ...rowLink, ...tableRow, width: 1, border: 0, bgcolor: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>{r.name}</Typography>
            <Pill label={label} tone={tone} />
          </Box>
          <Typography variant="body2" color="text.secondary" noWrap>
            {[r.interest, `${r.office} office`, when(r.created_at), r.franchisees?.name && `To ${r.franchisees.name}`].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <ChevronRight sx={{ color: 'text.secondary' }} />
      </Box>
    </Box>
  );
}

// Everything about one request: how to reach them, what they asked, allocation, notes and status.
function RequestPanel({ r, open, partners, onClose, onChanged }) {
  const [notes, setNotes] = useState(r.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function update(changes) {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('consultation_requests')
      .update({ ...changes, handled_by: user.id, handled_at: new Date().toISOString() }).eq('id', r.id);
    setBusy(false);
    if (error) return setError(errText(error));
    onChanged();
  }

  const [label, tone] = statusLook[r.status];
  return (
    // appear: a Drawer that mounts already open skips its slide-in unless told otherwise.
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 460 } } }, transition: { appear: true } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, borderBottom: `1px solid ${line}` }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>{r.name}</Typography>
        <Pill label={label} tone={tone} />
        <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Stack spacing={2.5} sx={{ p: 2.5 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Box>
          <Typography variant="body2" color="text.secondary">{r.interest} · {r.office} office · {when(r.created_at)}</Typography>
          {r.message && <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" startIcon={<PhoneIcon />} href={`tel:${r.phone}`}>{phoneText(r.phone)}</Button>
          <Button variant="outlined" startIcon={<WhatsAppIcon />} href={whatsapp(r.phone)} target="_blank" rel="noreferrer">WhatsApp</Button>
          {r.email && <Button variant="outlined" startIcon={<EmailIcon />} href={`mailto:${r.email}`} sx={{ textTransform: 'none' }}>{r.email}</Button>}
        </Box>
        {partners && (
          <TextField
            select label="Allocated to" value={r.franchisee_id ?? ''} disabled={busy}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            helperText="The partner sees this request on their Requests page."
            onChange={(e) => update({ franchisee_id: e.target.value || null })}
          >
            <MenuItem value="">Not allocated</MenuItem>
            {partners.filter((p) => p.active || p.id === r.franchisee_id).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
        )}
        <TextField
          label="Notes" multiline minRows={2} placeholder="e.g. Called, meeting on Monday" value={notes} onChange={(e) => setNotes(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {notes !== (r.notes ?? '') && <Button variant="contained" disabled={busy} onClick={() => update({ notes })}>Save note</Button>}
          {r.status === 'new' && <Button variant="contained" disabled={busy} onClick={() => update({ status: 'contacted', notes })}>Mark contacted</Button>}
          {r.status !== 'closed' && <Button variant="outlined" disabled={busy} onClick={() => update({ status: 'closed', notes })}>Close request</Button>}
          {r.status === 'closed' && <Button variant="outlined" disabled={busy} onClick={() => update({ status: 'contacted' })}>Reopen</Button>}
        </Box>
      </Stack>
    </Drawer>
  );
}

// A request that came in by phone or at the office, entered by staff and optionally allocated straight away.
function AddRequestDialog({ partners, office, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', interest: interests[0], office: office ?? offices[0].city, message: '', franchisee_id: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const phone = f.phone.replace(/[^0-9+]/g, '');
  const valid = f.name.trim().length >= 2 && /^\+?[0-9]{10,13}$/.test(phone) && (!f.email || /^\S+@\S+\.\S+$/.test(f.email));

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('consultation_requests').insert({
      ...f, name: f.name.trim(), phone, email: f.email.trim() || null, message: f.message.trim() || null, franchisee_id: f.franchisee_id || null,
    });
    setBusy(false);
    if (error) return setError(errText(error));
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" required autoFocus value={f.name} onChange={set('name')} />
          <TextField label="Phone" required type="tel" value={f.phone} onChange={set('phone')} helperText="10-digit mobile, or with +91" />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
          <TextField select label="Interested in" value={f.interest} onChange={set('interest')}>
            {interests.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
          </TextField>
          <TextField select label="Office" value={f.office} onChange={set('office')} disabled={Boolean(office)}>
            {offices.map((o) => <MenuItem key={o.city} value={o.city}>{o.city}</MenuItem>)}
          </TextField>
          <TextField select label="Allocated to" value={f.franchisee_id} onChange={set('franchisee_id')} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">Not allocated</MenuItem>
            {partners.filter((p) => p.active).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField label="Notes from the call (optional)" multiline minRows={2} value={f.message} onChange={set('message')} slotProps={{ htmlInput: { maxLength: 2000 } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !valid} onClick={save}>Add request</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Requests({ profile }) {
  const isStaff = profile.role !== 'franchisee';
  const allOffices = isStaff && (profile.role === 'admin' || !profile.office);
  const [partners, setPartners] = useState(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [shownId, setShownId] = useState(null); // stays set while the panel slides out
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('new');
  const [office, setOffice] = useState('all');
  const [limit, setLimit] = useState(PAGE_ROWS);

  function load() {
    if (isStaff) supabase.from('franchisees').select('id, name, active').order('name').then(({ data }) => setPartners(data ?? []));
    fetchAll((o) => supabase.from('consultation_requests').select('*, franchisees(name)', o).order('created_at', { ascending: false }).order('id'))
      .then(({ data, error }) => (error ? setError(errText(error)) : setRows(data)));
  }
  useEffect(load, []);
  useEffect(() => setLimit(PAGE_ROWS), [status, office]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows || (isStaff && !partners)) return null;
  const inOffice = rows.filter((r) => office === 'all' || r.office === office);
  const list = inOffice.filter((r) => status === 'all' || r.status === status);
  const count = (s) => inOffice.filter((r) => r.status === s).length;

  return (
    <>
      <PageTitle action={isStaff && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add request</Button>}>
        Requests
      </PageTitle>
      <Typography color="text.secondary" sx={{ mb: 2.5, maxWidth: '65ch' }}>
        {isStaff
          ? `Call-back requests from the website's contact form${allOffices ? '' : ` for the ${profile.office} office`}. Allocate one to a partner and they'll see it too.`
          : 'People who asked Exit for a call back, passed on to you. Call them, then note what happened.'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, mb: 2.5 }}>
        <FilterChips
          label="Filter by status" value={status} onChange={setStatus}
          options={[['new', `New (${count('new')})`], ['contacted', `Contacted (${count('contacted')})`], ['closed', 'Closed'], ['all', 'All']]}
        />
        {allOffices && (
          <FilterChips label="Filter by office" value={office} onChange={setOffice} options={[['all', 'All offices'], ...offices.map((o) => [o.city, o.city])]} />
        )}
      </Box>
      <Panel>
        {list.length === 0 && (
          <Typography color="text.secondary" sx={{ px: 3, py: 5, textAlign: 'center' }}>
            {status !== 'new' ? 'Nothing here.' : isStaff ? 'No new requests. New ones from the website appear here.' : 'No new requests. When Exit passes one to you, it appears here.'}
          </Typography>
        )}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {list.slice(0, limit).map((r) => <RequestRow key={r.id} r={r} onOpen={(x) => { setOpenId(x.id); setShownId(x.id); }} />)}
        </Box>
        <ShowMore shown={limit} total={list.length} onMore={() => setLimit(limit + PAGE_ROWS)} />
      </Panel>
      {/* Reads the request from the latest list, so it shows each change straight after saving. */}
      {shownId && rows.some((r) => r.id === shownId) && (() => {
        const r = rows.find((x) => x.id === shownId);
        return <RequestPanel key={r.id} r={r} open={openId === r.id} partners={partners} onClose={() => setOpenId(null)} onChanged={load} />;
      })()}
      {adding && (
        <AddRequestDialog
          partners={partners} office={allOffices ? null : profile.office}
          onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setStatus('new'); load(); }}
        />
      )}
    </>
  );
}
