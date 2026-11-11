import { useRef, useState } from 'react';
import { Box, Container, Typography, Stack } from '@mui/material';
import InsightsIcon from '@mui/icons-material/InsightsRounded';
import VisibilityIcon from '@mui/icons-material/VisibilityRounded';
import PersonIcon from '@mui/icons-material/SupportAgentRounded';
import VerifiedIcon from '@mui/icons-material/VerifiedUserRounded';
import ChatIcon from '@mui/icons-material/ChatBubbleRounded';
import SavingsIcon from '@mui/icons-material/SavingsRounded';
import BalanceIcon from '@mui/icons-material/BalanceRounded';
import { m, useMotionValueEvent, useScroll } from 'framer-motion';
import { inr } from '../finance';
import { accent, accentBright as bright, ink, mist, navy } from '../theme';

const rule = '1px solid rgba(18,40,74,.12)';
const amber = '#B4572E';
const gold = '#C9A54B';
const green = '#0B7A53';
const ease = [0.22, 1, 0.36, 1];

const pillars = [
  [InsightsIcon, 'Research first', 'Every suggestion is backed by research on the company and the market. No tips, no noise.'],
  [VisibilityIcon, 'Nothing hidden', 'Clear fees, clear reasons, clear reports. You always know what you own and why.'],
  [PersonIcon, 'One advisor who knows you', 'The same person every time, at our offices in Guntur, Ongole and Hyderabad.'],
  [VerifiedIcon, 'Honest about risk', 'We explain the downside before the upside, and never promise guaranteed returns.'],
];

const steps = [
  ['Meet', 'A relaxed first conversation about your goals, income and comfort with risk.'],
  ['Plan', 'A written plan: how much goes where, and the exit you are working toward.'],
  ['Invest', 'We help you open accounts and put the plan to work, step by step.'],
  ['Review', 'Regular check-ins to rebalance, book gains and stay on track.'],
];

const goals = [
  ["Child's education", 2034, 72, 'On track'],
  ['New home', 2030, 55, 'On track'],
  ['Retirement', 2045, 31, 'Add ₹3,000 a month'],
];
const mix = [['Stocks', 55, navy], ['Debt', 32, accent], ['Gold', 13, gold]];
const activity = [
  [SavingsIcon, 'SIP of ₹10,000 invested', '5 Nov', accent],
  [BalanceIcon, 'Rebalanced: ₹15,000 moved to debt', '18 Oct', navy],
];

// ₹1 lakh through a market with one sharp fall. One investor stays with the plan; the other sells at the bottom
// and only buys back once prices are well past the old high. Fixed numbers, so the story never changes.
const N = 48, W = 600, H = 220, ENTRY = 4, EXIT = 41;
const market = Array.from({ length: N + 1 }, (_, i) => {
  const t = i / N;
  return 0.25 + 0.74 * t ** 1.6 + 0.04 * Math.sin(i * 1.9) + 0.025 * Math.sin(i * 0.7 + 1) - 0.13 * Math.exp(-((t - 0.56) ** 2) / 0.003);
});
const argBy = (from, to, better) => { let k = from; for (let i = from; i <= to; i++) if (better(market[i], market[k])) k = i; return k; };
const PEAK = argBy(18, 26, (a, b) => a > b), SELL = argBy(PEAK, 31, (a, b) => a < b);
const REBUY = market.findIndex((v, i) => i > SELL && v >= market[PEAK] * 1.12);
const panic = market.map((v, i) => (i <= SELL ? v : i < REBUY ? market[SELL] : (market[SELL] * v) / market[REBUY]));
const TOP = Math.max(...market) * 1.08;
const xy = (v, i) => [(i / N) * W, H - (v / TOP) * H];
const path = (vals, from = 0, to = N) => vals.slice(from, to + 1).map((v, k) => xy(v, from + k)).map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
const planArea = `${path(market, ENTRY, EXIT)} L${xy(0, EXIT)[0]} ${H} L${xy(0, ENTRY)[0]} ${H}Z`;
const lakh = (v) => inr((v / market[ENTRY]) * 100000);
const fallPct = Math.round((1 - market[SELL] / market[PEAK]) * 100);
const at = (v, i) => { const [x, y] = xy(v, i); return { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }; };

function Pin({ v, i, label, color, align = 'center', below, delay }) {
  const shift = { start: '-14px', center: '-50%', end: 'calc(-100% + 14px)' }[align];
  return (
    <Box component={m.div} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay, duration: 0.3 }}
      sx={{ position: 'absolute', ...at(v, i), width: 0, height: 0, zIndex: 1 }}>
      <Box sx={{ position: 'absolute', width: 14, height: 14, ml: '-7px', mt: '-7px', borderRadius: '50%', bgcolor: navy, border: `3px solid ${color}`, boxShadow: `0 0 0 6px ${color}33` }} />
      <Box sx={{ position: 'absolute', transform: `translate(${shift}, ${below ? '18px' : 'calc(-100% - 18px)'})`, whiteSpace: 'nowrap',
        px: 1.25, py: 0.4, borderRadius: 99, bgcolor: color, color: ink, fontSize: 12.5, fontWeight: 700 }}>{label}</Box>
    </Box>
  );
}

// The headline card: what the same ₹1 lakh becomes when you stay with the plan, versus selling in the fall.
function Feature() {
  const results = [['Stayed with the plan', lakh(market[EXIT]), bright, 'solid'], ['Sold in the fall', lakh(panic[EXIT]), '#F0A35E', 'dashed']];
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 8, p: { xs: 3, md: 5 }, color: '#fff', display: 'flex', flexDirection: 'column',
      background: `radial-gradient(70% 60% at 100% 0%, rgba(52,211,153,.22), transparent 70%), linear-gradient(160deg, ${navy}, ${ink})` }}>
      <Typography variant="h2" sx={{ fontSize: { xs: '2rem', sm: '2.6rem', md: '3.1rem' }, maxWidth: 600 }}>
        Advice that knows when to enter, and when to exit.
      </Typography>
      <Typography sx={{ mt: 2, color: 'rgba(255,255,255,.72)', lineHeight: 1.7, maxWidth: 520, fontSize: { md: '1.1rem' } }}>
        The same ₹1 lakh, the same market. The difference is staying calm through the fall and stepping out at your goal.
      </Typography>

      <Box sx={{ mt: { xs: 3, md: 4 }, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, maxWidth: 560 }}>
        {results.map(([k, v, c, line]) => (
          <Box key={k} sx={{ p: { xs: 1.75, md: 2.25 }, borderRadius: 4, bgcolor: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 18, borderTop: `3px ${line} ${c}` }} />
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>{k}</Typography>
            </Stack>
            <Typography sx={{ mt: 0.5, fontWeight: 700, fontSize: { xs: 24, md: 32 }, letterSpacing: '-0.03em', color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
          </Box>
        ))}
      </Box>

      {/* top padding leaves room for the labels above the line */}
      <Box sx={{ position: 'relative', mt: 'auto', pt: { xs: 7, md: 8 } }}>
        <Box sx={{ position: 'relative', height: { xs: 170, md: 230 } }}>
          <Box component="svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="whyPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={bright} stopOpacity=".3" />
                <stop offset="1" stopColor={bright} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={path(market)} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <m.path d={planArea} fill="url(#whyPlan)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8, duration: 0.4 }} />
            <m.path d={path(panic, ENTRY, EXIT)} fill="none" stroke="#F0A35E" strokeWidth="2.5" strokeDasharray="6 6" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
            <m.path d={path(market, ENTRY, EXIT)} fill="none" stroke={bright} strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
          </Box>
          <Pin v={market[ENTRY]} i={ENTRY} label="Enter" color="#fff" align="start" delay={0.3} />
          <Pin v={panic[SELL]} i={SELL} label={`Market fell ${fallPct}%`} color="#F0A35E" below delay={0.7} />
          <Pin v={market[EXIT]} i={EXIT} label="Exit at your goal" color={bright} align="end" delay={1.1} />
        </Box>
      </Box>
      <Typography sx={{ mt: 2.5, fontSize: 12, color: 'rgba(255,255,255,.5)' }}>An illustration of investor behaviour, not real returns.</Typography>
    </Box>
  );
}

// What a client actually receives: a one-page plan with each goal and how it is going.
function PlanSample() {
  const fill = (w, delay) => ({ initial: { width: 0 }, whileInView: { width: `${w}%` }, viewport: { once: true }, transition: { delay, duration: 0.6, ease } });
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: 8, boxShadow: '0 40px 80px -40px rgba(10,24,48,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, px: { xs: 2.5, md: 3.5 }, py: 2, borderBottom: rule }}>
        <Box component="img" src="media/Exit256.png" alt="" sx={{ height: 22 }} />
        <Typography sx={{ fontWeight: 700, color: ink, flex: 1 }}>Your investment plan</Typography>
        <Box sx={{ px: 1.2, py: 0.3, borderRadius: 99, bgcolor: mist, fontSize: 12, color: 'text.secondary' }}>Sample</Box>
      </Stack>
      <Box sx={{ px: { xs: 2.5, md: 3.5 }, py: 3, flex: 1 }}>
        <Typography variant="body2" color="text.secondary">Your goals</Typography>
        <Stack spacing={2.5} sx={{ mt: 2 }}>
          {goals.map(([g, y, p, status], i) => {
            const ok = status === 'On track';
            return (
              <Box key={g}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600, color: ink }}>{g} <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>by {y}</Box></Typography>
                  <Typography variant="body2" sx={{ color: ok ? accent : amber, fontWeight: 700, whiteSpace: 'nowrap' }}>{status}</Typography>
                </Stack>
                <Box sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: 'rgba(18,40,74,.08)', overflow: 'hidden' }}>
                  <Box component={m.div} {...fill(p, 0.1 + i * 0.08)} sx={{ height: '100%', borderRadius: 4, bgcolor: ok ? accent : amber }} />
                </Box>
                <Typography variant="caption" color="text.secondary">{p}% of the way there</Typography>
              </Box>
            );
          })}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3.5 }}>How your money is split</Typography>
        <Box sx={{ mt: 1.5, display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', gap: '3px' }}>
          {mix.map(([k, v, c], i) => <Box key={k} component={m.div} {...fill(v, 0.3 + i * 0.06)} sx={{ bgcolor: c }} />)}
        </Box>
        <Stack direction="row" spacing={2.5} sx={{ mt: 1.5 }}>
          {mix.map(([k, v, c]) => (
            <Stack key={k} direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
              <Typography variant="body2" color="text.secondary">{k} <Box component="b" sx={{ color: ink, fontWeight: 700 }}>{v}%</Box></Typography>
            </Stack>
          ))}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3.5 }}>Recent activity</Typography>
        <Stack sx={{ mt: 1 }}>
          {activity.map(([Icon, what, when, c], i) => (
            <Stack key={what} direction="row" sx={{ alignItems: 'center', gap: 1.5, py: 1.25, borderTop: i ? rule : 'none' }}>
              <Box sx={{ width: 32, height: 32, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: `${c}1a`, color: c }}><Icon sx={{ fontSize: 18 }} /></Box>
              <Typography sx={{ flex: 1, fontSize: 14.5, color: ink }}>{what}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{when}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, px: { xs: 2.5, md: 3.5 }, py: 2, bgcolor: 'rgba(15,157,107,.07)' }}>
        <Box sx={{ position: 'relative', width: 40, height: 40, flexShrink: 0, borderRadius: '50%', bgcolor: navy, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
          A
          <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: '50%', bgcolor: accent, border: '2px solid #fff' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, color: ink, fontSize: 14.5 }}>Your advisor</Typography>
          <Typography variant="body2" color="text.secondary">Next review together, in person or on a call</Typography>
        </Box>
        <ChatIcon sx={{ color: green }} />
      </Stack>
    </Box>
  );
}

// A soft green light follows the cursor across the card (mouse only; nothing changes on touch screens).
const spotlight = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
};

function Pillar({ Icon, title, text }) {
  return (
    <Box onMouseMove={spotlight}
      sx={{ position: 'relative', borderRadius: 6, p: 3, bgcolor: '#fff', border: '1px solid rgba(18,40,74,.06)', overflow: 'hidden',
        transition: 'transform .3s ease, box-shadow .3s ease',
        '&::before': { content: '""', position: 'absolute', inset: 0, opacity: 0, transition: 'opacity .3s', pointerEvents: 'none',
          background: 'radial-gradient(320px circle at var(--x, 50%) var(--y, 50%), rgba(15,157,107,.13), transparent 60%)' },
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 30px 60px -36px rgba(10,24,48,.45)' },
        '&:hover::before': { opacity: 1 } }}>
      <Box sx={{ position: 'relative', width: 46, height: 46, borderRadius: 3.5, display: 'grid', placeItems: 'center', color: '#fff',
        background: `linear-gradient(150deg, #19B47F, ${green})`, boxShadow: '0 10px 20px -10px rgba(11,122,83,.8)' }}>
        <Icon fontSize="small" />
      </Box>
      <Typography sx={{ position: 'relative', mt: 2.5, fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em', color: ink }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ position: 'relative', mt: 1, lineHeight: 1.7 }}>{text}</Typography>
    </Box>
  );
}

// The four steps: the line fills as you scroll, and each step lights up as the fill reaches it.
function Track() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 60%'] });
  const [reached, setReached] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setReached(Math.min(steps.length, Math.floor(v * steps.length + 0.35))));
  return (
    <Box ref={ref} component="ol" sx={{ position: 'relative', listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(4, 1fr)' },
      gap: { xs: 4, md: 3 }, pl: { xs: 7, md: 0 } }}>
      {/* track and fill: down the side on phones, across on desktop */}
      <Box sx={{ position: 'absolute', bgcolor: 'rgba(18,40,74,.1)', borderRadius: 2, left: { xs: 21, md: 22 }, right: { md: 'calc(25% - 22px)' }, top: { xs: 8, md: 21 }, bottom: { xs: 8, md: 'auto' }, width: { xs: 3, md: 'auto' }, height: { md: 3 } }} />
      <Box component={m.div} style={{ scaleX: scrollYProgress }} sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', left: 22, right: 'calc(25% - 22px)', top: 21, height: 3, borderRadius: 2, bgcolor: green, transformOrigin: 'left' }} />
      <Box component={m.div} style={{ scaleY: scrollYProgress }} sx={{ display: { md: 'none' }, position: 'absolute', left: 21, top: 8, bottom: 8, width: 3, borderRadius: 2, bgcolor: green, transformOrigin: 'top' }} />
      {steps.map(([s, t], i) => {
        const on = i < reached;
        return (
          <Box component="li" key={s} sx={{ position: 'relative' }}>
            <Box sx={{ position: { xs: 'absolute', md: 'relative' }, left: { xs: -56, md: 0 }, top: { xs: -6, md: 0 }, width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700,
              bgcolor: on ? green : '#fff', color: on ? '#fff' : 'text.secondary', border: on ? 'none' : '2px solid rgba(18,40,74,.15)',
              boxShadow: on ? '0 0 0 7px rgba(15,157,107,.15)' : 'none', transition: 'all .35s ease' }}>{i + 1}</Box>
            <Typography sx={{ mt: { md: 2.5 }, fontWeight: 700, fontSize: 21, color: ink }}>{s}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7, maxWidth: 300 }}>{t}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function Why() {
  return (
    <Box id="why" component="section" sx={{ py: { xs: 10, md: 14 }, bgcolor: mist, scrollMarginTop: 64 }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '7fr 5fr' }, gap: 2.5 }}>
          <Feature />
          <PlanSample />
        </Box>
        <Box sx={{ mt: { xs: 5, md: 8 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2.5 }}>
          {pillars.map(([Icon, title, text]) => <Pillar key={title} Icon={Icon} title={title} text={text} />)}
        </Box>

        <Box sx={{ mt: { xs: 10, md: 14 } }}>
          <Typography variant="h2" sx={{ fontSize: { xs: '1.9rem', md: '2.5rem' }, mb: { xs: 5, md: 6 } }}>How we work with you</Typography>
          <Track />
        </Box>
      </Container>
    </Box>
  );
}
