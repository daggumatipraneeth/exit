import { useState } from 'react';
import { Box, Container, Typography, Slider, ToggleButton, ToggleButtonGroup, Stack, Button, Link } from '@mui/material';
import SectionHeading from '../components/SectionHeading';
import { sipValue, lumpValue, inr } from '../finance';
import { accentBright as bright, ink, mist, navy } from '../theme';

const W = 600, H = 240, N = 24;

// One tap fills in a typical goal; the sliders still adjust from there.
const presets = [
  ["Child's education", 5000, 15],
  ['Dream home', 15000, 10],
  ['Retirement', 10000, 25],
];

function Chart({ invested, value, max }) {
  const pt = (arr) => arr.map((v, i) => `${(i / N) * W},${H - (v / max) * (H - 10)}`);
  const line = (arr) => `M${pt(arr).join(' L')}`;
  const ease = { transition: 'd .6s cubic-bezier(.22,1,.36,1)' };
  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" sx={{ width: '100%', height: { xs: 160, md: 220 }, display: 'block' }}>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,.08)" />)}
      <path d={`${line(value)} L${W},${H} L0,${H}Z`} fill={bright} fillOpacity=".15" style={ease} />
      <path d={line(value)} fill="none" stroke={bright} strokeWidth="2.5" vectorEffect="non-scaling-stroke" style={ease} />
      <path d={line(invested)} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" style={ease} />
    </Box>
  );
}

function Field({ label, display, ...slider }) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography color="text.secondary">{label}</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: 18, color: ink, fontVariantNumeric: 'tabular-nums' }}>{display}</Typography>
      </Stack>
      <Slider {...slider}
        sx={{ color: navy, height: 4, mt: 0.5, '& .MuiSlider-thumb': { width: 20, height: 20, bgcolor: '#fff', border: `2px solid ${navy}`, boxShadow: 'none', '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 6px rgba(18,40,74,.12)' } }, '& .MuiSlider-rail': { opacity: 0.15 } }} />
    </Box>
  );
}

export default function SipCalculator() {
  const [mode, setMode] = useState('sip');
  const [amount, setAmount] = useState(10000);
  const [lump, setLump] = useState(500000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);

  const isSip = mode === 'sip';
  const at = (t) => (isSip ? sipValue(amount, t, rate) : lumpValue(lump, t, rate));
  const inv = (t) => (isSip ? amount * 12 * t : lump);
  const ts = Array.from({ length: N + 1 }, (_, i) => (years * i) / N);
  const value = ts.map(at), invested = ts.map(inv);
  const total = value[N], put = invested[N], gain = total - put;

  return (
    <Box id="calculator" component="section" sx={{ py: { xs: 10, md: 16 }, scrollMarginTop: 64 }}>
      <Container maxWidth="xl">
        <SectionHeading title="See what steady investing can do" subtitle="Pick a goal, or move the sliders, to see how a monthly SIP or a one-time investment could grow." />
        <Stack direction="row" sx={{ mb: 2.5, gap: 1, flexWrap: 'wrap' }}>
          {presets.map(([label, a, y]) => {
            const on = isSip && amount === a && years === y;
            return (
              <Button key={label} onClick={() => { setMode('sip'); setAmount(a); setYears(y); }} aria-pressed={on}
                sx={{ py: 1, px: 2, border: '1px solid', borderColor: on ? navy : 'rgba(18,40,74,.2)', bgcolor: on ? navy : '#fff', color: on ? '#fff' : ink, fontWeight: 500,
                  '&:hover': { bgcolor: on ? navy : mist } }}>
                {label} <Box component="span" sx={{ ml: 1, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{inr(a)}/month for {y} yrs</Box>
              </Button>
            );
          })}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '5fr 7fr' }, borderRadius: 6, overflow: 'hidden', bgcolor: '#fff', boxShadow: '0 40px 80px -40px rgba(10,24,48,.4)', border: '1px solid rgba(18,40,74,.06)' }}>
          <Stack spacing={4} sx={{ p: { xs: 3, md: 5 } }}>
            <ToggleButtonGroup exclusive fullWidth value={mode} onChange={(_, v) => v && setMode(v)}
              sx={{ bgcolor: mist, p: 0.5, borderRadius: 99, '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', textTransform: 'none', fontWeight: 600, py: 1 },
                '& .Mui-selected': { bgcolor: '#fff !important', color: `${ink} !important`, boxShadow: '0 1px 3px rgba(18,40,74,.15)' } }}>
              <ToggleButton value="sip">Monthly SIP</ToggleButton>
              <ToggleButton value="lump">One-time</ToggleButton>
            </ToggleButtonGroup>
            {isSip
              ? <Field label="Every month" value={amount} display={inr(amount)} min={500} max={200000} step={500} onChange={(_, v) => setAmount(v)} aria-label="Monthly investment" />
              : <Field label="One-time amount" value={lump} display={inr(lump)} min={10000} max={10000000} step={10000} onChange={(_, v) => setLump(v)} aria-label="One-time investment" />}
            <Field label="For how long" value={years} display={`${years} years`} min={1} max={40} onChange={(_, v) => setYears(v)} aria-label="Years" />
            <Field label="Expected return a year" value={rate} display={`${rate}%`} min={1} max={30} step={0.5} onChange={(_, v) => setRate(v)} aria-label="Expected return" />
            <Typography variant="caption" color="text.secondary">
              For illustration only. Returns are not guaranteed; mutual fund investments are subject to market risks. <Link href="#/risk">Read the risk disclosure</Link>.
            </Typography>
          </Stack>

          <Box sx={{ p: { xs: 3, md: 5 }, color: '#fff', background: `linear-gradient(150deg, ${navy}, ${ink})`, display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ color: 'rgba(255,255,255,.7)' }}>After {years} years you could have</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 40, md: 56 }, lineHeight: 1.1, letterSpacing: '-0.035em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {inr(total)}
            </Typography>
            <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {[['You put in', put, 'rgba(255,255,255,.6)', 'dashed'], ['It could earn', gain, bright, 'solid']].map(([k, v, c, s]) => (
                <Box key={k} sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(255,255,255,.07)' }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 16, borderTop: `2px ${s} ${c}` }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.7)' }}>{k}</Typography>
                  </Stack>
                  <Typography sx={{ fontWeight: 700, fontSize: 20, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', mt: 4 }}>
              <Box sx={{ width: '100%' }}>
                <Chart invested={invested} value={value} max={total * 1.05} />
                <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.6)' }}>Today</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.6)' }}>Year {years}</Typography>
                </Stack>
              </Box>
            </Box>
            <Button variant="contained" href="#contact" sx={{ mt: 3, alignSelf: 'flex-start', bgcolor: bright, color: ink, '&:hover': { bgcolor: '#2BC48C' } }}>Get a plan made for you</Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
