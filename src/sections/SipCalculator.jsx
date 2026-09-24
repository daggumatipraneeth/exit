import { useState } from 'react';
import { Box, Container, Typography, Slider, ToggleButton, ToggleButtonGroup, Stack, Button } from '@mui/material';
import Reveal from '../components/Reveal';
import SectionHeading from '../components/SectionHeading';
import { sipValue, lumpValue, inr } from '../finance';
import { accent, accentSoft, ink, navy } from '../theme';

const W = 600, H = 280, N = 24;

function Chart({ invested, value, max }) {
  const pt = (arr) => arr.map((v, i) => `${(i / N) * W},${H - (v / max) * (H - 20)}`);
  const line = (arr) => `M${pt(arr).join(' L')}`;
  const area = (arr) => `${line(arr)} L${W},${H} L0,${H}Z`;
  const ease = { transition: 'd .7s cubic-bezier(.22,1,.36,1)' };
  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" sx={{ width: '100%', height: { xs: 200, md: 260 }, display: 'block' }}>
      <defs>
        <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity=".45" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={navy} stopOpacity=".25" />
          <stop offset="1" stopColor={navy} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(18,40,74,.08)" strokeDasharray="4 6" />)}
      <path d={area(value)} fill="url(#gv)" style={ease} />
      <path d={line(value)} fill="none" stroke={accent} strokeWidth="3" vectorEffect="non-scaling-stroke" style={ease} />
      <path d={area(invested)} fill="url(#gi)" style={ease} />
      <path d={line(invested)} fill="none" stroke={navy} strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" style={ease} />
    </Box>
  );
}

function Field({ label, value, display, ...slider }) {
  return (
    <Box>
      <Stack sx={{ justifyContent: "space-between", alignItems: "baseline" }} direction="row">
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography sx={{ fontWeight: 700, color: navy, px: 1.5, py: 0.4, borderRadius: 2, bgcolor: 'rgba(18,40,74,.06)', fontVariantNumeric: 'tabular-nums' }}>{display}</Typography>
      </Stack>
      <Slider value={value} {...slider}
        sx={{ color: navy, height: 6, mt: 1, '& .MuiSlider-thumb': { width: 22, height: 22, bgcolor: '#fff', border: `3px solid ${accent}`, boxShadow: '0 4px 12px rgba(18,40,74,.25)', '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 8px ${accentSoft}55` } }, '& .MuiSlider-rail': { opacity: 0.12 } }} />
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
      <Container maxWidth="lg">
        <SectionHeading overline="Plan your future" title="See what discipline can do" subtitle="Move the sliders to see how a steady SIP or a one-time investment could grow over time." />
        <Reveal>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, borderRadius: 5, overflow: 'hidden', bgcolor: '#fff', border: '1px solid rgba(18,40,74,.08)', boxShadow: '0 40px 80px -50px rgba(18,40,74,.45)' }}>
            <Stack spacing={4} sx={{ p: { xs: 3, md: 5 } }}>
              <ToggleButtonGroup exclusive fullWidth value={mode} onChange={(_, v) => v && setMode(v)}
                sx={{ bgcolor: 'rgba(18,40,74,.05)', p: 0.5, borderRadius: 99, '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', textTransform: 'none', fontWeight: 600, py: 1 },
                  '& .Mui-selected': { bgcolor: `${navy} !important`, color: '#fff !important' } }}>
                <ToggleButton value="sip">Monthly SIP</ToggleButton>
                <ToggleButton value="lump">Lump sum</ToggleButton>
              </ToggleButtonGroup>
              {isSip
                ? <Field label="Monthly investment" value={amount} display={inr(amount)} min={500} max={200000} step={500} onChange={(_, v) => setAmount(v)} aria-label="Monthly investment" />
                : <Field label="Total investment" value={lump} display={inr(lump)} min={10000} max={10000000} step={10000} onChange={(_, v) => setLump(v)} aria-label="Total investment" />}
              <Field label="Time period" value={years} display={`${years} yrs`} min={1} max={40} onChange={(_, v) => setYears(v)} aria-label="Years" />
              <Field label="Expected return (p.a.)" value={rate} display={`${rate}%`} min={1} max={30} step={0.5} onChange={(_, v) => setRate(v)} aria-label="Expected return" />
              <Typography variant="caption" color="text.secondary">
                For illustration only. Returns are not guaranteed; mutual fund investments are subject to market risks.
              </Typography>
            </Stack>

            <Box sx={{ p: { xs: 3, md: 5 }, background: `linear-gradient(160deg, #FAFCFB, #F3F7F5)`, display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" spacing={{ xs: 2, md: 4 }} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
                {[['Invested', put, navy], ['Est. returns', gain, '#0B7A53']].map(([k, v, c]) => (
                  <Box key={k}>
                    <Stack sx={{ alignItems: "center" }} direction="row" spacing={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
                      <Typography variant="caption" color="text.secondary">{k}</Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</Typography>
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 3 }}>Projected value</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: { xs: 36, md: 48 }, lineHeight: 1.1, letterSpacing: '-0.03em', color: ink, fontVariantNumeric: 'tabular-nums' }}>
                {inr(total)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600, mb: 2 }}>
                {(total / put).toFixed(1)}× your money in {years} years
              </Typography>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <Box sx={{ width: '100%' }}>
                  <Chart invested={invested} value={value} max={total * 1.05} />
                  <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">Today</Typography>
                    <Typography variant="caption" color="text.secondary">Year {years}</Typography>
                  </Stack>
                </Box>
              </Box>
              <Button variant="contained" href="#contact" sx={{ mt: 3, alignSelf: 'flex-start' }}>Get a personalised plan</Button>
            </Box>
          </Box>
        </Reveal>
      </Container>
    </Box>
  );
}
