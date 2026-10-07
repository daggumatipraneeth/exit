// Customer onboarding: details form, capital, KYC documents, signing link, approval.
import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Alert, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, InputAdornment, CircularProgress, Link,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CopyIcon from '@mui/icons-material/ContentCopy';
import UploadIcon from '@mui/icons-material/FileUploadOutlined';
import { supabase, fetchAll } from './supabase';
import { money } from '../finance';
import { accent, line } from '../theme';
import { today, shortDate, Panel, PageTitle, FormPage, errText } from './ui';
import { AgreementFrame } from './Sign';

export const docKinds = [
  ['pan', 'PAN card', true],
  ['aadhaar_front', 'Aadhaar front', true],
  ['aadhaar_back', 'Aadhaar back', true],
  ['photo', 'Customer photo', false],
];
const editable = ['draft', 'awaiting_signature'];
export const latestSigned = (agreements) =>
  agreements.filter((a) => a.signed_at).sort((a, b) => b.signed_at.localeCompare(a.signed_at))[0];
export const canEdit = (profile, c) => profile.role !== 'franchisee' || editable.includes(c.status);

const blank = { full_name: '', phone: '', email: '', dob: '', address: '', pan: '', aadhaar_last4: '', franchisee_id: '', cap_pct: 6 };

function DetailsFields({ f, setF, profile, partners }) {
  const set = (k, fn = (v) => v) => (e) => setF({ ...f, [k]: fn(e.target.value) });
  const panOk = !f.pan || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan);
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <TextField label="Full name (as on PAN)" required value={f.full_name} onChange={set('full_name')} sx={{ gridColumn: '1 / -1' }} />
      <TextField label="Phone" required type="tel" value={f.phone} onChange={set('phone')} autoComplete="off" />
      <TextField label="Email" type="email" value={f.email ?? ''} onChange={set('email')} autoComplete="off" />
      <TextField label="Date of birth" type="date" value={f.dob ?? ''} onChange={set('dob')} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField
        label="PAN" value={f.pan ?? ''} onChange={set('pan', (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
        error={!panOk} helperText={panOk ? 'Like ABCDE1234F' : 'PAN is 5 letters, 4 digits, 1 letter'}
      />
      <TextField
        label="Aadhaar, last 4 digits only" value={f.aadhaar_last4 ?? ''} onChange={set('aadhaar_last4', (v) => v.replace(/\D/g, '').slice(0, 4))}
        helperText="We never store the full Aadhaar number." slotProps={{ htmlInput: { inputMode: 'numeric' }, input: { startAdornment: <InputAdornment position="start">XXXX XXXX</InputAdornment> } }}
      />
      {profile.role !== 'franchisee' && (
        <TextField select label="Partner" required value={partners ? f.franchisee_id : ''} onChange={set('franchisee_id')} disabled={!partners}>
          {(partners ?? []).filter((p) => p.active || p.id === f.franchisee_id).map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.active ? p.name : `${p.name} (inactive)`}</MenuItem>
          ))}
        </TextField>
      )}
      {profile.role !== 'franchisee' && (
        <TextField
          label="Monthly cap" type="number" value={f.cap_pct} onChange={set('cap_pct')}
          slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 }, input: { endAdornment: <InputAdornment position="end">% of capital</InputAdornment> } }}
        />
      )}
      <TextField label="Address" multiline minRows={2} value={f.address ?? ''} onChange={set('address')} sx={{ gridColumn: '1 / -1' }} />
    </Box>
  );
}

const detailsValid = (f, profile) =>
  f.full_name.trim() && f.phone.trim() && (!f.pan || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan)) &&
  (!f.aadhaar_last4 || f.aadhaar_last4.length === 4) && (profile.role === 'franchisee' || f.franchisee_id);

const toRow = (f, profile) => {
  const row = {
    full_name: f.full_name.trim(), phone: f.phone.trim(), email: f.email || null, dob: f.dob || null,
    address: f.address || null, pan: f.pan || null, aadhaar_last4: f.aadhaar_last4 || null,
    franchisee_id: profile.role === 'franchisee' ? profile.franchisee_id : f.franchisee_id,
  };
  if (profile.role !== 'franchisee') row.cap_pct = Number(f.cap_pct);
  return row;
};

const friendly = (e) => (/customers_pan_key/.test(errText(e)) ? 'Another customer already has this PAN.' : errText(e));

// null while loading. Includes inactive partners so a customer's current partner always shows;
// those can't be newly chosen.
function usePartners(profile) {
  const [partners, setPartners] = useState(null);
  useEffect(() => {
    if (profile.role !== 'franchisee') fetchAll((o) => supabase.from('franchisees').select('id, name, active', o).order('name').order('id')).then(({ data }) => setPartners(data ?? []));
  }, []);
  return partners;
}

export function NewCustomer({ profile }) {
  const partners = usePartners(profile);
  const [f, setF] = useState(blank);
  const [capital, setCapital] = useState('');
  const [capitalFrom, setCapitalFrom] = useState(today());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.from('customers').insert({ ...toRow(f, profile), status: 'draft' }).select('id').single();
    if (error) { setBusy(false); return setError(friendly(error)); }
    if (Number(capital) > 0) {
      const { error } = await supabase.from('customer_capital').insert({ customer_id: data.id, effective_from: capitalFrom || today(), amount: Number(capital) });
      if (error) { setBusy(false); return setError(errText(error)); }
    }
    window.location.hash = `#/customers/${data.id}`;
  }

  return (
    <FormPage>
      <Link href="#/customers" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, mb: 1, fontWeight: 500 }}>Back to customers</Link>
      <PageTitle>Add customer</PageTitle>
      <Panel>
        <Box component="form" onSubmit={save} sx={{ px: { xs: 2, md: 3 }, py: 3, display: 'grid', gap: 2 }}>
          <Typography color="text.secondary">
            Start with the basics. You can save now and add documents and the signing link on the next screen.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <DetailsFields f={f} setF={setF} profile={profile} partners={partners} />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
            <TextField
              label="Capital" type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
              helperText="Amount the customer is investing. The monthly cap is a % of this."
              slotProps={{ htmlInput: { min: 1, inputMode: 'decimal' }, input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
            />
            <TextField
              label="Capital from" type="date" value={capitalFrom} onChange={(e) => setCapitalFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }} helperText="The customer shares in results from this day."
            />
          </Box>
          <Button type="submit" variant="contained" size="large" disabled={busy || !detailsValid(f, profile)} sx={{ justifySelf: { xs: 'stretch', sm: 'end' } }}>
            Save and continue
          </Button>
        </Box>
      </Panel>
    </FormPage>
  );
}

export function EditDetailsDialog({ customer, profile, onClose, onSaved }) {
  const partners = usePartners(profile);
  const [f, setF] = useState(Object.fromEntries(Object.keys(blank).map((k) => [k, customer[k] ?? ''])));
  const [error, setError] = useState('');

  async function save() {
    const { error } = await supabase.from('customers').update(toRow(f, profile)).eq('id', customer.id);
    if (error) return setError(friendly(error));
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit {customer.full_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <DetailsFields f={f} setF={setF} profile={profile} partners={partners} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!detailsValid(f, profile)} onClick={save}>Save details</Button>
      </DialogActions>
    </Dialog>
  );
}

export function CapitalDialog({ customer, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(today());
  const [error, setError] = useState('');

  async function save() {
    const { error } = await supabase.from('customer_capital').upsert({ customer_id: customer.id, effective_from: from, amount: Number(amount) }, { onConflict: 'customer_id,effective_from' });
    if (error) return setError(errText(error));
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Set capital</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Capital" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
            slotProps={{ htmlInput: { min: 1, inputMode: 'decimal' }, input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
          />
          <TextField
            label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
            helperText="A month's cap uses the capital in force on the 1st of that month."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!(Number(amount) > 0) || !from} onClick={save}>Save capital</Button>
      </DialogActions>
    </Dialog>
  );
}

// Phone photos are often 3-8 MB; shrink to a readable JPEG before upload.
async function shrink(file) {
  if (!file.type.startsWith('image/')) return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
  } catch {
    return file; // unsupported format in this browser: let the server check type and size
  }
}

export function Documents({ customer, docs, edit, onChanged }) {
  const [urls, setUrls] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notImage, setNotImage] = useState({}); // PDFs can't preview as <img>

  useEffect(() => {
    if (!docs.length) return setUrls({});
    supabase.storage.from('kyc').createSignedUrls(docs.map((d) => d.path), 600).then(({ data }) => {
      setUrls(Object.fromEntries((data ?? []).map((u) => [u.path, u.signedUrl])));
    });
  }, [docs]);

  async function upload(kind, file) {
    if (!file) return;
    setBusy(kind);
    setError('');
    const blob = await shrink(file);
    if (blob.size > 5 * 1024 * 1024) { setBusy(null); return setError('That file is over 5 MB. Take a smaller photo or compress the PDF.'); }
    // Every upload is a new file; earlier versions are kept (the database refuses deletes and overwrites).
    const path = `${customer.id}/${kind}-${Date.now()}`;
    const up = await supabase.storage.from('kyc').upload(path, blob, { contentType: blob.type || file.type });
    const row = up.error ? up : await supabase.from('customer_documents').insert({ customer_id: customer.id, kind, path });
    setBusy(null);
    if (row.error) return setError(errText(row.error));
    onChanged();
  }

  return (
    <Panel title="KYC documents">
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 2, p: { xs: 2, md: 3 } }}>
        {docKinds.map(([kind, label, required]) => {
          const versions = docs.filter((x) => x.kind === kind).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
          const d = versions[0];
          const url = d && urls[d.path];
          return (
            <Box key={kind} sx={{ minWidth: 0 }}>
              <Box
                component={url ? 'a' : 'div'}
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={d ? `Open ${label}` : undefined}
                sx={{
                  display: 'grid', placeItems: 'center', aspectRatio: '4 / 3', borderRadius: 1.5, overflow: 'hidden',
                  border: d ? `1px solid ${line}` : '1px dashed #9AA8BC', bgcolor: '#F8FAFC', color: 'text.secondary', textDecoration: 'none',
                }}
              >
                {busy === kind ? <CircularProgress size={24} aria-label="Uploading" /> : url && !notImage[url] ? (
                  <Box component="img" src={url} alt={label} sx={{ width: 1, height: 1, objectFit: 'cover' }} onError={() => setNotImage({ ...notImage, [url]: true })} />
                ) : <Typography variant="body2">{url ? 'Open file' : d ? 'Loading…' : required ? 'Required' : 'Optional'}</Typography>}
              </Box>
              <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 500 }}>{label}</Typography>
              {versions.length > 1 && (
                <Typography variant="caption" color="text.secondary" component="p">
                  Earlier:{' '}
                  {versions.slice(1).map((v, i) => (
                    <span key={v.path}>
                      {i > 0 && ', '}
                      <Link href={urls[v.path]} target="_blank" rel="noreferrer">{shortDate(v.uploaded_at.slice(0, 10))}</Link>
                    </span>
                  ))}
                </Typography>
              )}
              {edit && (
                <Button size="small" component="label" startIcon={<UploadIcon />} sx={{ ml: -1, px: 1 }}>
                  {d ? 'Replace' : 'Upload'}
                  <input hidden type="file" accept="image/*,application/pdf" onChange={(e) => { upload(kind, e.target.files[0]); e.target.value = ''; }} />
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
    </Panel>
  );
}

export function AgreementDialog({ agreement, onClose }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Signed agreement</DialogTitle>
      <DialogContent dividers>
        <AgreementFrame html={agreement.rendered_html} />
        {agreement.signature_png && <Box component="img" src={agreement.signature_png} alt="Customer's signature" sx={{ maxWidth: 320, width: '100%', mt: 2, borderBottom: `1px solid ${line}` }} />}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Signed by {agreement.signer_name} on {new Date(agreement.signed_at).toLocaleString('en-IN')}
          {agreement.signer_ip && ` from IP ${agreement.signer_ip}`}.
        </Typography>
        {agreement.html_sha256 && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere', display: 'block', mt: 0.5 }}>Fingerprint (SHA-256): {agreement.html_sha256}</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

function Step({ done, title, children }) {
  return (
    <Box component="li" sx={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 1.5, py: 1.75, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
      {done ? <CheckCircle sx={{ color: accent }} /> : <RadioUnchecked sx={{ color: '#9AA8BC' }} />}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        {children}
      </Box>
    </Box>
  );
}

// The onboarding checklist shown until the customer is active.
export function OnboardingSteps({ customer: c, profile, capital, docs, agreements, onEdit, onCapital, onChanged }) {
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const edit = canEdit(profile, c);
  const isAdmin = profile.role === 'admin';
  const detailsDone = c.pan && c.aadhaar_last4;
  const docsDone = docKinds.filter(([, , req]) => req).every(([k]) => docs.some((d) => d.kind === k));
  const lastSigned = latestSigned(agreements);
  // After a rejection is reopened the customer signs again, so an older signature doesn't count.
  const signed = ['pending_approval', 'active'].includes(c.status) ? lastSigned : null;
  const pending = agreements.find((a) => !a.signed_at && new Date(a.token_expires_at) > new Date());
  const link = pending && `${window.location.href.split('#')[0]}#/sign/${pending.sign_token}`;
  const wa = link && `https://wa.me/${c.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hello ${c.full_name}, please read and sign your Exit agreement here: ${link}`)}`;

  async function createLink() {
    setMsg(null);
    const { error } = await supabase.rpc('create_signing_link', { p_customer: c.id });
    if (error) return setMsg(['error', errText(error)]);
    onChanged();
  }
  async function setStatus(status) {
    const { error } = await supabase.from('customers').update({ status }).eq('id', c.id);
    if (error) return setMsg(['error', errText(error)]);
    onChanged();
  }
  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Panel title="Onboarding">
      <Box sx={{ px: { xs: 2, md: 3 }, py: 0.5 }}>
        {msg && <Alert severity={msg[0]} sx={{ mt: 2 }}>{msg[1]}</Alert>}
        {c.status === 'rejected' && (
          <Alert severity="error" sx={{ mt: 2 }} action={profile.role !== 'franchisee' && <Button color="inherit" size="small" onClick={() => setStatus('draft')}>Reopen</Button>}>
            Exit rejected this application.
          </Alert>
        )}
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          <Step done={detailsDone} title="Customer details">
            <Typography variant="body2" color="text.secondary">{detailsDone ? 'PAN and Aadhaar added.' : 'Add PAN and the last 4 digits of Aadhaar.'}</Typography>
            {edit && <Button size="small" onClick={onEdit} sx={{ ml: -1, mt: 0.5, px: 1 }}>Edit details</Button>}
          </Step>
          <Step done={capital.length > 0} title="Capital">
            <Typography variant="body2" color="text.secondary">{capital[0] ? `${money(capital[0].amount)} from ${shortDate(capital[0].effective_from)}` : 'How much the customer is investing.'}</Typography>
            {edit && <Button size="small" onClick={onCapital} sx={{ ml: -1, mt: 0.5, px: 1 }}>{capital.length ? 'Change capital' : 'Set capital'}</Button>}
          </Step>
          <Step done={docsDone} title="KYC documents">
            <Typography variant="body2" color="text.secondary">{docsDone ? 'PAN and Aadhaar photos uploaded.' : 'Upload the PAN card and both sides of a masked Aadhaar in the documents section.'}</Typography>
          </Step>
          <Step done={!!signed} title="Customer signs the agreement">
            {signed ? (
              <Typography variant="body2" color="text.secondary">Signed by {signed.signer_name} on {shortDate(signed.signed_at.slice(0, 10))}.</Typography>
            ) : link ? (
              <>
                <Typography variant="body2" color="text.secondary">Send this link to the customer. It works until {shortDate(pending.token_expires_at.slice(0, 10))}.</Typography>
                <Box sx={{ mt: 1, p: 1.25, bgcolor: '#F8FAFC', border: `1px solid ${line}`, borderRadius: 1.5, fontSize: 13, overflowWrap: 'anywhere' }}>{link}</Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  <Button size="small" variant="contained" color="success" startIcon={<WhatsAppIcon />} href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</Button>
                  <Button size="small" variant="outlined" startIcon={<CopyIcon />} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                  {edit && <Button size="small" onClick={createLink}>Make a new link</Button>}
                </Box>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {lastSigned
                    ? `Signed earlier on ${shortDate(lastSigned.signed_at.slice(0, 10))}, before the application was reopened. Create a new link so the customer signs again.`
                    : 'When the steps above are done, create a link for the customer to read and sign on their phone.'}
                </Typography>
                {edit && <Button size="small" variant="contained" onClick={createLink} disabled={!detailsDone || !capital.length || !docsDone} sx={{ mt: 1 }}>Create signing link</Button>}
              </>
            )}
          </Step>
          <Step done={c.status === 'active'} title="Exit approves">
            {c.status === 'pending_approval' && isAdmin ? (
              <>
                <Typography variant="body2" color="text.secondary">Check the documents and the signed agreement, then approve.</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button size="small" variant="contained" onClick={() => setStatus('active')}>Approve customer</Button>
                  <Button size="small" color="error" variant="outlined" onClick={() => setStatus('rejected')}>Reject</Button>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {c.status === 'pending_approval' ? 'Waiting for Exit to review.' : 'After the customer signs, Exit reviews and approves.'}
              </Typography>
            )}
          </Step>
        </Box>
      </Box>
    </Panel>
  );
}
