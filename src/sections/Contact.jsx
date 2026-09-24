import { useState } from 'react';
import { Box, Container, Typography, TextField, MenuItem, Button, Stack, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MailIcon from '@mui/icons-material/MailOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import Reveal from '../components/Reveal';
import { company } from '../config';
import { accentBright, accentSoft, ink, navy } from '../theme';

const interests = ['Stock Advisory', 'Mutual Funds / SIP', 'Portfolio Management', 'Wealth Management', 'Retirement Planning', 'Tax Planning', 'Insurance', 'Demat / IPO', 'Something else'];
const empty = { name: '', phone: '', email: '', interest: interests[1], city: 'Guntur', message: '' };

export default function Contact() {
  const [f, setF] = useState(empty);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const errors = {
    name: !f.name.trim() && 'Please enter your name',
    phone: !/^[+\d][\d\s-]{9,14}$/.test(f.phone.trim()) && 'Enter a valid phone number',
    email: f.email && !/^\S+@\S+\.\S+$/.test(f.email) && 'Enter a valid email',
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const body = `Name: ${f.name}\nPhone: ${f.phone}\nEmail: ${f.email}\nInterested in: ${f.interest}\nPreferred office: ${f.city}\n\n${f.message}`;
    window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(`Consultation request — ${f.interest}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };
  const err = (k) => ({ error: touched && !!errors[k], helperText: touched && errors[k] });

  return (
    <Box id="contact" component="section" sx={{ py: { xs: 10, md: 16 }, bgcolor: '#F7F9F8', scrollMarginTop: 64 }}>
      <Container maxWidth="lg">
        <Reveal>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, borderRadius: 5, overflow: 'hidden', boxShadow: '0 50px 100px -50px rgba(18,40,74,.5)' }}>
            <Box sx={{ position: 'relative', p: { xs: 4, md: 6 }, color: '#fff', background: `linear-gradient(160deg, ${navy}, ${ink})`, overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', bottom: -120, right: -120, width: 320, height: 320, borderRadius: '50%', border: `1px solid ${accentBright}44` }} />
              <Box sx={{ position: 'absolute', bottom: -60, right: -60, width: 200, height: 200, borderRadius: '50%', border: `1px solid ${accentBright}66` }} />
              <Typography variant="overline" sx={{ color: accentBright }}>Let's talk</Typography>
              <Typography variant="h3" sx={{ mt: 1, fontSize: { xs: 32, md: 42 } }}>Your first consultation is on us.</Typography>
              <Typography sx={{ mt: 2, color: 'rgba(255,255,255,.7)', lineHeight: 1.8 }}>
                Share a few details and an advisor from your nearest office will call you within one working day.
              </Typography>
              <Stack spacing={2.5} sx={{ mt: 5, position: 'relative' }}>
                {[[PhoneIcon, company.phone, `tel:${company.phone.replace(/\s/g, '')}`], [MailIcon, company.email, `mailto:${company.email}`], [WhatsAppIcon, 'Chat on WhatsApp', `https://wa.me/${company.whatsapp}`]].map(([Icon, t, href]) => (
                  <Stack key={t} component="a" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" direction="row" spacing={2}
                    sx={{ alignItems: "center", color: '#fff', textDecoration: 'none', '&:hover span': { color: accentSoft } }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.15)' }}><Icon fontSize="small" /></Box>
                    <Box component="span" sx={{ transition: 'color .3s' }}>{t}</Box>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Box component="form" noValidate onSubmit={submit} sx={{ p: { xs: 3, md: 6 }, bgcolor: '#fff' }}>
              <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label="Full name" required value={f.name} onChange={set('name')} {...err('name')} />
                <TextField label="Phone" required type="tel" value={f.phone} onChange={set('phone')} {...err('phone')} />
                <TextField label="Email" type="email" value={f.email} onChange={set('email')} {...err('email')} />
                <TextField select label="Preferred office" value={f.city} onChange={set('city')}>
                  {['Guntur', 'Hyderabad'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField select label="I'm interested in" value={f.interest} onChange={set('interest')} sx={{ gridColumn: { sm: '1 / -1' } }}>
                  {interests.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField label="Message (optional)" multiline minRows={4} value={f.message} onChange={set('message')} sx={{ gridColumn: { sm: '1 / -1' } }} />
              </Box>
              {sent && <Alert severity="success" sx={{ mt: 3 }}>Your email app should now be open with your request — just hit send. Prefer WhatsApp? Use the green button.</Alert>}
              <Button type="submit" size="large" variant="contained" endIcon={<SendIcon />} sx={{ mt: 4, py: 1.6, px: 5 }}>Request a call back</Button>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                We respect your privacy. Your details are used only to contact you about your enquiry.
              </Typography>
            </Box>
          </Box>
        </Reveal>
      </Container>
    </Box>
  );
}
