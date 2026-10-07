import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Alert, TextField, Checkbox, FormControlLabel, CircularProgress } from '@mui/material';
import { supabase } from './supabase';
import { company } from '../config';
import { ink, line } from '../theme';
import { errText } from './ui';

// Agreement HTML in a sandboxed frame (no scripts), grown to its content height so the page scrolls, not the frame.
export function AgreementFrame({ html }) {
  const ref = useRef();
  const fit = () => { const d = ref.current?.contentDocument; if (d) ref.current.style.height = `${d.documentElement.scrollHeight + 8}px`; };
  const doc = `<!doctype html><meta name="viewport" content="width=device-width"><style>
    body{font:16px/1.6 Inter,system-ui,sans-serif;color:${ink};margin:0;padding:4px 2px;overflow-wrap:anywhere}
    h1,h2,h3{line-height:1.25} li{margin:.4em 0}</style>${html}`;
  useEffect(() => { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, []);
  return <Box component="iframe" ref={ref} title="Agreement" sandbox="allow-same-origin" srcDoc={doc} onLoad={fit} sx={{ border: 0, width: '100%', display: 'block', minHeight: 200 }} />;
}

function SignaturePad({ onChange }) {
  const ref = useRef();
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current;
    let width = 0;
    const size = () => {
      const r = c.getBoundingClientRect();
      if (r.width === width) return; // phones fire resize when the address bar hides; don't wipe the signature
      width = r.width;
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      Object.assign(ctx, { lineWidth: 2.2, lineCap: 'round', lineJoin: 'round', strokeStyle: ink });
      onChange(null);
    };
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, []);

  const point = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => {
    drawing.current = true;
    ref.current.setPointerCapture(e.pointerId);
    const ctx = ref.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = ref.current.getContext('2d');
    ctx.lineTo(...point(e));
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(ref.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    onChange(null);
  };

  return (
    <Box>
      <Box
        component="canvas"
        ref={ref}
        aria-label="Signature pad: draw your signature with your finger or mouse"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        sx={{ width: '100%', height: 180, display: 'block', bgcolor: '#fff', border: `1px dashed #9AA8BC`, borderRadius: 2, touchAction: 'none', cursor: 'crosshair' }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="body2" color="text.secondary">Sign inside the box</Typography>
        <Button size="small" onClick={clear}>Clear</Button>
      </Box>
    </Box>
  );
}

export default function Sign({ token }) {
  const [a, setA] = useState(undefined);
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState('');
  const [signature, setSignature] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc('get_agreement', { p_token: token }).then(({ data, error }) => (error ? setA(null) : setA(data)));
  }, [token]);

  async function sign() {
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('sign_agreement', { p_token: token, p_name: name, p_signature: signature });
    setBusy(false);
    if (error) return setError(errText(error));
    setDone(true);
    window.scrollTo(0, 0);
  }

  let body;
  if (a === undefined) body = <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress aria-label="Loading" /></Box>;
  else if (!a) body = <Alert severity="error">This signing link is not valid. Check that you opened the full link your partner sent.</Alert>;
  else if (done || a.signed_at) body = (
    <Alert severity="success">
      Thank you, {a.customer}. Your agreement is signed. Exit will review your documents and your partner will let you know when your account is active.
    </Alert>
  );
  else if (a.expired) body = <Alert severity="warning">This signing link has expired. Ask your partner to send you a new one.</Alert>;
  else body = (
    <>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: { xs: '1.6rem', md: '2rem' } }}>
        Your agreement with {company.short}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {a.customer}, please read the agreement below, then sign at the bottom.
      </Typography>
      <Box sx={{ bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2, p: { xs: 2, md: 4 } }}>
        <AgreementFrame html={a.html} />
      </Box>
      <Box sx={{ bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2, p: { xs: 2, md: 4 }, mt: 3, display: 'grid', gap: 2.5 }}>
        <Typography variant="h6" component="h2">Sign the agreement</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <FormControlLabel
          control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} />}
          label="I have read this agreement, I agree to its terms, and the KYC documents I gave are mine and true."
          sx={{ alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.25 } }}
        />
        <TextField label="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" helperText={`As on your PAN card: ${a.customer}`} />
        <SignaturePad onChange={setSignature} />
        <Button variant="contained" size="large" disabled={busy || !agree || name.trim().length < 3 || !signature} onClick={sign}>
          Sign agreement
        </Button>
        <Typography variant="body2" color="text.secondary">
          We record the date, time and your device's IP address with your signature.
        </Typography>
      </Box>
    </>
  );

  return (
    <Box sx={{ minHeight: '100dvh', px: 2, py: { xs: 3, md: 6 } }}>
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <Box component="img" src="media/Exit256.png" alt={company.name} sx={{ height: 34, mb: { xs: 3, md: 5 } }} />
        {body}
      </Box>
    </Box>
  );
}
