import { useEffect, useState } from 'react';
import { Box, Typography, Alert, Button, Chip, TextField, Link } from '@mui/material';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { supabase, fetchAll } from './supabase';
import { offices } from '../config';
import { line } from '../theme';
import { Panel, PageTitle, FilterChips, ShowMore, PAGE_ROWS, errText } from './ui';

const statusLook = { new: ['New', 'warning'], contacted: ['Contacted', 'info'], closed: ['Closed', 'default'] };
const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const whatsapp = (phone) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`;

function RequestRow({ r, onChanged }) {
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

  const [label, color] = statusLook[r.status];
  return (
    <Box component="li" sx={{ px: { xs: 2, md: 3 }, py: 2, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontWeight: 600, flex: '1 1 auto' }}>{r.name}</Typography>
        <Chip size="small" label={label} color={color} variant={r.status === 'new' ? 'filled' : 'outlined'} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {r.interest} · {r.office} office · {when(r.created_at)}
      </Typography>
      {r.message && <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
        <Button size="small" variant="outlined" startIcon={<PhoneIcon />} href={`tel:${r.phone}`}>{r.phone}</Button>
        <Button size="small" variant="outlined" startIcon={<WhatsAppIcon />} href={whatsapp(r.phone)} target="_blank" rel="noreferrer">WhatsApp</Button>
        {r.email && <Button size="small" variant="outlined" href={`mailto:${r.email}`} sx={{ textTransform: 'none' }}>{r.email}</Button>}
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1, mt: 1.5 }}>
        <TextField
          size="small" placeholder="Notes, e.g. called, meeting on Monday" value={notes} onChange={(e) => setNotes(e.target.value)}
          sx={{ flex: '1 1 260px' }} slotProps={{ htmlInput: { 'aria-label': `Notes for ${r.name}`, maxLength: 1000 } }}
        />
        {notes !== (r.notes ?? '') && <Button size="small" variant="contained" disabled={busy} onClick={() => update({ notes })}>Save note</Button>}
        {r.status === 'new' && <Button size="small" variant="contained" disabled={busy} onClick={() => update({ status: 'contacted', notes })}>Mark contacted</Button>}
        {r.status !== 'closed' && <Button size="small" disabled={busy} onClick={() => update({ status: 'closed', notes })}>Close</Button>}
        {r.status === 'closed' && <Button size="small" disabled={busy} onClick={() => update({ status: 'contacted' })}>Reopen</Button>}
      </Box>
    </Box>
  );
}

export default function Requests({ profile }) {
  const allOffices = profile.role === 'admin' || !profile.office;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('new');
  const [office, setOffice] = useState('all');
  const [limit, setLimit] = useState(PAGE_ROWS);

  function load() {
    fetchAll((o) => supabase.from('consultation_requests').select('*', o).order('created_at', { ascending: false }).order('id'))
      .then(({ data, error }) => (error ? setError(errText(error)) : setRows(data)));
  }
  useEffect(load, []);
  useEffect(() => setLimit(PAGE_ROWS), [status, office]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows) return null;
  const inOffice = rows.filter((r) => office === 'all' || r.office === office);
  const list = inOffice.filter((r) => status === 'all' || r.status === status);
  const count = (s) => inOffice.filter((r) => r.status === s).length;

  return (
    <>
      <PageTitle>Requests</PageTitle>
      <Typography color="text.secondary" sx={{ mb: 2.5, maxWidth: '65ch' }}>
        Call-back requests from the website's contact form{allOffices ? '' : ` for the ${profile.office} office`}.
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
            {status === 'new' ? 'No new requests. New ones from the website appear here.' : 'Nothing here.'}
          </Typography>
        )}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {list.slice(0, limit).map((r) => <RequestRow key={`${r.id}${r.status}${r.notes}`} r={r} onChanged={load} />)}
        </Box>
        <ShowMore shown={limit} total={list.length} onMore={() => setLimit(limit + PAGE_ROWS)} />
      </Panel>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        <Link href="#/today" underline="hover">Back to today</Link>
      </Typography>
    </>
  );
}
