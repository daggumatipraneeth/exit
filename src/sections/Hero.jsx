import { Box, Container, Typography, Button, Stack } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import HomeIcon from '@mui/icons-material/HomeRounded';
import FlagIcon from '@mui/icons-material/FlagRounded';
import SavingsIcon from '@mui/icons-material/SavingsRounded';
import PersonIcon from '@mui/icons-material/PersonRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import FamilyIcon from '@mui/icons-material/FamilyRestroomRounded';
import { m } from 'framer-motion';
import { offices, stats, upcoming } from '../config';
import { accent, ink, mist, navy } from '../theme';

const ease = [0.22, 1, 0.36, 1];
const green = '#0B7A53';
const spark = 'M0 52 L14 47 L28 50 L42 40 L56 43 L70 33 L84 36 L98 26 L112 29 L126 18 L140 21 L154 10 L168 13 L180 4';

const holdings = [['Index fund', 'I', 42, navy], ['Flexi-cap fund', 'F', 28, accent], ['Debt fund', 'D', 18, '#5B7BB0'], ['Gold', 'G', 12, '#C9A54B']];

// A sample portfolio screen inside a phone frame, built in CSS so it stays sharp at any size.
function Phone() {
  return (
    <Box sx={{ position: 'relative', width: { xs: 250, md: 290 }, aspectRatio: '9 / 18.5', borderRadius: '44px', p: '10px', bgcolor: ink,
      boxShadow: '0 50px 100px -30px rgba(10,24,48,.55), inset 0 0 0 2px #2a3a55' }}>
      <Box sx={{ position: 'relative', height: '100%', borderRadius: '34px', overflow: 'hidden', bgcolor: '#F6F8F7', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 84, height: 22, borderRadius: 99, bgcolor: ink }} />
        <Stack direction="row" sx={{ justifyContent: 'space-between', px: 2.5, pt: 1.2, fontSize: 11, fontWeight: 600, color: ink }}>
          <span>9:41</span><span>●●●</span>
        </Stack>
        <Box sx={{ px: 2, pt: 2.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box component="img" src="media/Exit256.png" alt="" sx={{ height: 18 }} />
            <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#E3ECE8', display: 'grid', placeItems: 'center' }}><PersonIcon sx={{ fontSize: 16, color: navy }} /></Box>
          </Stack>

          <Box sx={{ mt: 1.5, p: 1.75, borderRadius: 4, color: '#fff', background: `linear-gradient(150deg, ${navy}, ${ink})` }}>
            <Typography sx={{ fontSize: 10.5, opacity: 0.7 }}>Your portfolio</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>₹24,86,310</Typography>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, mt: 0.5, px: 0.8, py: 0.2, borderRadius: 99, bgcolor: 'rgba(52,211,153,.18)', color: '#34D399', fontSize: 10.5, fontWeight: 600 }}>
              <TrendingUpIcon sx={{ fontSize: 13 }} />+18.4% this year
            </Box>
            <Box component="svg" viewBox="0 0 180 56" sx={{ display: 'block', width: '100%', height: 46, mt: 1, overflow: 'visible' }}>
              <defs>
                <linearGradient id="ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34D399" stopOpacity=".35" /><stop offset="1" stopColor="#34D399" stopOpacity="0" /></linearGradient>
              </defs>
              <m.path d={`${spark} L180 56 L0 56Z`} fill="url(#ph)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.4 }} />
              <m.path d={spark} fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.8, ease }} />
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
              {['1M', '6M', '1Y', '5Y'].map((p) => (
                <Box key={p} sx={{ flex: 1, textAlign: 'center', py: 0.3, borderRadius: 99, fontSize: 10, fontWeight: 600, bgcolor: p === '1Y' ? 'rgba(255,255,255,.16)' : 'transparent', opacity: p === '1Y' ? 1 : 0.6 }}>{p}</Box>
              ))}
            </Stack>
          </Box>

          <Typography sx={{ mt: 1.75, fontSize: 12.5, fontWeight: 600, color: ink }}>Holdings</Typography>
          <Stack spacing={0.9} sx={{ mt: 0.9 }}>
            {holdings.map(([name, l, p, c], i) => (
              <Stack key={name} direction="row" spacing={1} sx={{ alignItems: 'center', bgcolor: '#fff', borderRadius: 2.5, px: 1.2, py: 0.9 }}>
                <Box sx={{ width: 24, height: 24, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${c}1f`, color: c, fontSize: 11, fontWeight: 700 }}>{l}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: ink, lineHeight: 1.2 }}>{name}</Typography>
                  <Box sx={{ mt: 0.5, height: 3, borderRadius: 2, bgcolor: 'rgba(18,40,74,.08)' }}>
                    <Box component={m.div} initial={{ width: 0 }} animate={{ width: `${p * 2}%` }} transition={{ delay: 0.35 + i * 0.06, duration: 0.5, ease }} sx={{ height: '100%', borderRadius: 2, bgcolor: c }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: ink, fontVariantNumeric: 'tabular-nums' }}>{p}%</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Stack direction="row" sx={{ mt: 'auto', justifyContent: 'space-around', py: 1.2, pb: 1.8, bgcolor: '#fff', borderTop: '1px solid rgba(18,40,74,.06)' }}>
          {[HomeIcon, FlagIcon, SavingsIcon, PersonIcon].map((I, i) => <I key={i} sx={{ fontSize: 20, color: i ? 'rgba(18,40,74,.35)' : green }} />)}
        </Stack>
      </Box>
    </Box>
  );
}

// Small cards around the phone: they slide in once, then stay still.
function Float({ children, sx, delay }) {
  return (
    <Box component={m.div} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4, ease }}
      sx={{ position: 'absolute', zIndex: 2, bgcolor: 'rgba(255,255,255,.97)', borderRadius: 4, p: 1.5, boxShadow: '0 24px 48px -20px rgba(10,24,48,.35), 0 0 0 1px rgba(18,40,74,.06)', ...sx }}>
      {children}
    </Box>
  );
}

function Ring({ value }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <Box component="svg" viewBox="0 0 44 44" sx={{ width: 44, height: 44, transform: 'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(18,40,74,.1)" strokeWidth="5" />
      <m.circle cx="22" cy="22" r={r} fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ delay: 0.6, duration: 0.7, ease }} />
    </Box>
  );
}

function Showcase() {
  return (
    <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center', py: { xs: 4, md: 6 } }}>
      {/* the green stage behind the phone */}
      <Box aria-hidden sx={{ position: 'absolute', inset: { xs: '12% 0', md: '10% 4%' }, borderRadius: { xs: 6, md: 8 }, overflow: 'hidden',
        background: `linear-gradient(150deg, #19B47F 0%, ${green} 55%, #075C3F 100%)` }}>
        {[260, 420, 580].map((s) => <Box key={s} sx={{ position: 'absolute', right: -s / 3, top: -s / 3, width: s, height: s, borderRadius: '50%', border: '1px solid rgba(255,255,255,.14)' }} />)}
        <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.2) 1px, transparent 1px)', backgroundSize: '18px 18px', maskImage: 'linear-gradient(to top, #000, transparent 70%)' }} />
      </Box>
      <Box component={m.div} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.55, ease }} sx={{ position: 'relative', zIndex: 1 }}>
        <Phone />
      </Box>

      <Float delay={0.45} sx={{ top: { xs: '14%', md: '16%' }, left: { xs: 0, md: '-2%' }, display: 'flex', alignItems: 'center', gap: 1.2, pr: 2 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: accent, color: '#fff' }}><CheckIcon sx={{ fontSize: 20 }} /></Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ink, lineHeight: 1.2 }}>SIP invested</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>₹10,000 on 5 Nov</Typography>
        </Box>
      </Float>

      <Float delay={0.55} sx={{ display: { xs: 'none', sm: 'flex' }, top: '42%', right: { sm: '2%', md: '-4%' }, alignItems: 'center', gap: 1.5, pr: 2 }}>
        <Box sx={{ position: 'relative' }}>
          <Ring value={72} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: ink }}>72%</Box>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ink, lineHeight: 1.2 }}>Child's education</Typography>
          <Typography sx={{ fontSize: 12, color: accent, fontWeight: 600 }}>On track for 2034</Typography>
        </Box>
      </Float>

      <Float delay={0.65} sx={{ display: { xs: 'none', sm: 'block' }, bottom: { xs: '8%', md: '6%' }, right: { xs: 0, md: 'auto' }, left: { md: '-6%' }, maxWidth: { xs: 200, md: 240 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: navy, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>A</Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ink }}>Your advisor</Typography>
        </Stack>
        <Typography sx={{ mt: 0.8, fontSize: 12.5, color: ink, lineHeight: 1.5 }}>Markets dipped today. No action needed, your plan is on track.</Typography>
      </Float>
    </Box>
  );
}

const cities = offices.map((o) => o.city).join(', ').replace(/, ([^,]*)$/, ' and $1');

export default function Hero() {
  return (
    <Box id="top" component="section" sx={{ position: 'relative', pt: { xs: 12, md: 15 }, pb: { xs: 6, md: 8 }, overflow: 'hidden',
      background: 'radial-gradient(60% 50% at 0% 0%, rgba(15,157,107,.08), transparent 70%), #fff' }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1fr 1fr' }, gap: { xs: 2, md: 6 }, alignItems: 'center' }}>
          <Box component={m.div} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            {upcoming[0] && (
              <Box component="a" href="#offices" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, pl: 0.6, pr: 1.6, py: 0.6, borderRadius: 99, bgcolor: mist, fontSize: 13.5, color: ink, mb: 3, textDecoration: 'none', '&:hover': { bgcolor: '#E8EEEC' } }}>
                <Box component="span" sx={{ px: 1, py: 0.2, borderRadius: 99, bgcolor: green, color: '#fff', fontWeight: 600, fontSize: 12 }}>New</Box>
                {upcoming[0]} office opening soon
              </Box>
            )}
            <Typography variant="h1" sx={{ fontSize: { xs: 'clamp(2.5rem, 11.5vw, 3.3rem)', sm: '3.8rem', md: '3.6rem', lg: '4.4rem' }, fontWeight: 700, color: ink }}>
              Build wealth with clarity. Exit with confidence.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2.5, maxWidth: 480, fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.65 }}>
              Stocks, mutual funds and SIPs, guided by an advisor who knows you. See everything clearly, and know exactly when to step out.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
              <Button size="large" variant="contained" href="#contact" sx={{ py: 1.6, px: 3.5, fontSize: 16, boxShadow: '0 14px 28px -12px rgba(11,122,83,.6)' }}>Book a free consultation</Button>
              <Button size="large" variant="outlined" href="#calculator" sx={{ py: 1.6, px: 3.5, fontSize: 16, color: ink, borderColor: 'rgba(18,40,74,.2)', '&:hover': { borderColor: ink, bgcolor: 'transparent' } }}>Try the SIP calculator</Button>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 4, alignItems: 'center' }}>
              <Box aria-hidden sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(15,157,107,.12)', color: green }}>
                <FamilyIcon />
              </Box>
              <Typography variant="body2" sx={{ color: ink, lineHeight: 1.4 }}>
                <b>{stats[1].value.toLocaleString('en-IN')}{stats[1].suffix} families</b> advised<br />in {cities}
              </Typography>
            </Stack>
          </Box>
          <Showcase />
        </Box>

        <Box sx={{ mt: { xs: 4, md: 6 }, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: { xs: 1.5, md: 2 } }}>
          {stats.map((s) => (
            <Box key={s.label} sx={{ p: { xs: 2, md: 3 }, borderRadius: 5, bgcolor: mist }}>
              <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 700, letterSpacing: '-0.03em', color: ink, fontVariantNumeric: 'tabular-nums' }}>
                {s.prefix}{s.value.toLocaleString('en-IN')}{s.suffix}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: { xs: 13, md: 14 }, color: 'text.secondary' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>The portfolio screen is a sample, for illustration only.</Typography>
      </Container>
    </Box>
  );
}
