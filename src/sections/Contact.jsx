import { useState } from 'react';
import { Box, Container, Typography, TextField, MenuItem, Button, Stack, Alert, IconButton, Tooltip, Link } from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { company, offices, interests } from '../config';
import { accent, ink, mist } from '../theme';

const empty = { name: '', phone: '', email: '', interest: interests[1], city: offices[0].city, message: '', website: '' };

// Saves the request for the chosen office (portal → Requests). A plain fetch keeps the landing page free of the
// Supabase library. Without portal settings in the build, falls back to the visitor's email app.
const api = import.meta.env.VITE_SUPABASE_URL;
const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
async function sendRequest(f) {
  const r = await fetch(`${api}/rest/v1/rpc/request_consultation`, {
    method: 'POST',
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_name: f.name, p_phone: f.phone, p_email: f.email, p_interest: f.interest, p_office: f.city, p_message: f.message, p_website: f.website }),
  });
  if (r.ok) return null;
  const body = await r.json().catch(() => ({}));
  return body.message ?? "Couldn't send your request. Please call us or use WhatsApp.";
}

const tel = `tel:${company.phone.replace(/\s/g, '')}`;

// The one place the site lists how to reach us: a single number for calls and WhatsApp, plus email.
function Reach() {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(company.phone).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  return (
    <Box sx={{ mt: { xs: 4, md: 5 }, p: { xs: 2.5, md: 3.5 }, borderRadius: 6, bgcolor: '#fff', boxShadow: '0 30px 60px -40px rgba(10,24,48,.4)' }}>
      <Typography color="text.secondary">Call or WhatsApp, for every office</Typography>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, mt: 0.5 }}>
        <Typography component="a" href={tel} sx={{ color: ink, textDecoration: 'none', fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(28px, 8vw, 40px)', whiteSpace: 'nowrap' }}>
          {company.phone}
        </Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy number'}>
          <IconButton onClick={copy} aria-label="Copy phone number" sx={{ color: copied ? accent : 'text.secondary' }}>
            {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
        <Button variant="contained" href={tel} startIcon={<PhoneIcon />} sx={{ flex: { xs: 1, sm: 'none' } }}>Call</Button>
        <Button variant="outlined" href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noopener noreferrer" startIcon={<WhatsAppIcon sx={{ color: '#128C4B' }} />}
          sx={{ flex: { xs: 1, sm: 'none' }, borderColor: 'rgba(18,40,74,.25)' }}>WhatsApp</Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mt: 3 }}>
        Or email{' '}
        <Box component="a" href={`mailto:${company.email}`} sx={{ color: ink, fontWeight: 600, textUnderlineOffset: 3 }}>{company.email}</Box>
      </Typography>
    </Box>
  );
}

export default function Contact() {
  const [f, setF] = useState(empty);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const errors = {
    name: !f.name.trim() && 'Please enter your name',
    phone: !/^[+\d][\d\s-]{9,14}$/.test(f.phone.trim()) && 'Enter a valid phone number',
    email: f.email && !/^\S+@\S+\.\S+$/.test(f.email) && 'Enter a valid email',
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || sending) return;
    if (!api) {
      const body = `Name: ${f.name}\nPhone: ${f.phone}\nEmail: ${f.email}\nInterested in: ${f.interest}\nPreferred office: ${f.city}\n\n${f.message}`;
      window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(`Consultation request — ${f.interest}`)}&body=${encodeURIComponent(body)}`;
      return setSent('email');
    }
    setSending(true);
    setSendError('');
    const problem = await sendRequest(f).catch(() => "Couldn't send your request. Please check your connection, or call us.");
    setSending(false);
    if (problem) return setSendError(problem);
    setSent(f.city);
    setF(empty);
    setTouched(false);
  };
  const err = (k) => ({ error: touched && !!errors[k], helperText: touched && errors[k] });

  return (
    <Box id="contact" component="section" sx={{ py: { xs: 10, md: 16 }, bgcolor: mist, scrollMarginTop: 64 }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '5fr 7fr' }, gap: { xs: 6, md: 10 } }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', sm: '2.6rem', md: '3.25rem' } }}>Your first consultation is free.</Typography>
            <Typography color="text.secondary" sx={{ mt: 2, lineHeight: 1.7, fontSize: { md: '1.15rem' } }}>
              Leave your details and an advisor from your nearest office will call you within one working day.
            </Typography>
            <Reach />
          </Box>

          <Box component="form" noValidate onSubmit={submit} sx={{ p: { xs: 3, md: 5 }, bgcolor: '#fff', borderRadius: 6, boxShadow: '0 30px 60px -40px rgba(10,24,48,.4)' }}>
            <Typography variant="h3" sx={{ fontSize: { xs: 22, md: 26 }, mb: 3 }}>Ask for a call back</Typography>
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr' } }}>
              <TextField label="Full name" required value={f.name} onChange={set('name')} {...err('name')} />
              <TextField label="Phone" required type="tel" value={f.phone} onChange={set('phone')} {...err('phone')} />
              <TextField label="Email" type="email" value={f.email} onChange={set('email')} {...err('email')} />
              <TextField select label="Nearest office" value={f.city} onChange={set('city')}>
                {offices.map((o) => <MenuItem key={o.city} value={o.city}>{o.city}</MenuItem>)}
              </TextField>
              <TextField select label="I'm interested in" value={f.interest} onChange={set('interest')} sx={{ gridColumn: { sm: '1 / -1' } }}>
                {interests.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField label="Message (optional)" multiline minRows={3} value={f.message} onChange={set('message')} sx={{ gridColumn: { sm: '1 / -1' } }} />
              {/* Hidden from people; bots that fill every field get silently ignored. */}
              <Box component="input" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')}
                sx={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
            </Box>
            {sendError && <Alert severity="error" sx={{ mt: 3 }}>{sendError}</Alert>}
            {sent === 'email' && <Alert severity="success" sx={{ mt: 3 }}>Your email app should now be open with your request — just hit send. Prefer WhatsApp? Use the green button.</Alert>}
            {sent && sent !== 'email' && <Alert severity="success" sx={{ mt: 3 }}>Thank you, we've received your request. Our {sent} office will call you within one working day.</Alert>}
            <Button type="submit" size="large" variant="contained" disabled={sending} sx={{ mt: 3, width: { xs: '100%', sm: 'auto' } }}>
              {sending ? 'Sending…' : 'Request a call back'}
            </Button>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              By sending this you agree that Exit may use these details to contact you about your enquiry, as set out in our <Link href="#/privacy">Privacy policy</Link>.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
