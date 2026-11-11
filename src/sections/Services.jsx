import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Container, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleRounded';
import ShieldIcon from '@mui/icons-material/ShieldRounded';
import { m } from 'framer-motion';
import SectionHeading from '../components/SectionHeading';
import { sipValue, inr } from '../finance';
import { accent, ink, mist, navy } from '../theme';

const gold = '#C9A54B';
const panel = { bgcolor: '#fff', borderRadius: 4, p: 2, boxShadow: '0 1px 2px rgba(18,40,74,.06), 0 12px 24px -16px rgba(18,40,74,.25)' };
const small = { fontSize: 12.5, color: 'text.secondary' };

// Mutual funds: pick an amount and see what it could become. A live mini-calculator.
function SipMock() {
  const [amt, setAmt] = useState(5000);
  return (
    <Box sx={panel}>
      <Typography sx={small}>Start a monthly SIP</Typography>
      <Typography sx={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: ink, fontVariantNumeric: 'tabular-nums' }}>{inr(amt)}</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {[1000, 5000, 10000, 25000].map((a) => (
          <ButtonBase key={a} onClick={() => setAmt(a)} aria-pressed={amt === a}
            sx={{ flex: 1, py: 0.8, borderRadius: 99, fontSize: 13, fontWeight: 600, border: '1px solid', borderColor: amt === a ? accent : 'rgba(18,40,74,.15)',
              bgcolor: amt === a ? 'rgba(15,157,107,.1)' : '#fff', color: amt === a ? '#0B7A53' : ink, transition: 'all .2s' }}>
            {a >= 1000 ? `₹${a / 1000}k` : a}
          </ButtonBase>
        ))}
      </Stack>
      <Stack direction="row" sx={{ mt: 2, p: 1.5, borderRadius: 3, bgcolor: mist, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={small}>Could grow to, in 10 years</Typography>
        <Typography component={m.span} key={amt} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} sx={{ fontWeight: 700, color: '#0B7A53', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {inr(sipValue(amt, 10, 12))}
        </Typography>
      </Stack>
    </Box>
  );
}

// Stock advisory: a sample call with entry, target and stop-loss marked on the price.
function CallMock() {
  const price = 'M0 70 L20 64 L40 68 L60 58 L80 62 L100 50 L120 46 L140 50 L160 36 L180 30 L200 34 L220 22 L240 16';
  return (
    <Box sx={panel}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 700, color: ink }}>Sample call</Typography>
        <Box sx={{ px: 1, py: 0.25, borderRadius: 99, bgcolor: 'rgba(15,157,107,.12)', color: '#0B7A53', fontSize: 12, fontWeight: 700 }}>Target reached</Box>
      </Stack>
      <Box component="svg" viewBox="0 0 240 86" preserveAspectRatio="none" sx={{ display: 'block', width: '100%', height: 86, mt: 1.5 }}>
        <line x1="0" x2="240" y1="16" y2="16" stroke={accent} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2="240" y1="62" y2="62" stroke={navy} strokeOpacity=".5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2="240" y1="80" y2="80" stroke="#B4572E" strokeOpacity=".6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <m.path d={price} fill="none" stroke={ink} strokeWidth="2" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
      </Box>
      <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {[['Exit at', '₹1,480', accent], ['Enter at', '₹1,240', navy], ['Stop-loss', '₹1,170', '#B4572E']].map(([k, v, c]) => (
          <Box key={k}>
            <Typography sx={{ ...small, display: 'flex', alignItems: 'center', gap: 0.6 }}><Box component="span" sx={{ width: 10, borderTop: `2px dashed ${c}` }} />{k}</Typography>
            <Typography sx={{ fontWeight: 700, color: ink, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function MixMock() {
  const mix = [['Stocks', 55, navy], ['Debt', 32, accent], ['Gold', 13, gold]];
  return (
    <Box sx={{ ...panel, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 76, height: 76, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${navy} 0 55%, ${accent} 0 87%, ${gold} 0)`, display: 'grid', placeItems: 'center' }}>
        <Box sx={{ width: 50, height: 50, borderRadius: '50%', bgcolor: '#fff' }} />
      </Box>
      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {mix.map(([k, v, c]) => (
          <Stack key={k} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
            <Typography sx={{ fontSize: 13, color: ink, flex: 1 }}>{k}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: ink }}>{v}%</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function TaxMock() {
  return (
    <Box sx={panel}>
      <Typography sx={small}>Tax you could save</Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: '#0B7A53', fontVariantNumeric: 'tabular-nums' }}>₹46,800</Typography>
      <Box sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: 'rgba(18,40,74,.08)', overflow: 'hidden' }}>
        <Box component={m.div} initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true }} transition={{ duration: 0.6 }} sx={{ height: '100%', bgcolor: accent }} />
      </Box>
      <Typography sx={{ ...small, mt: 0.8, fontSize: 11.5 }}>₹1.5 L under 80C, 30% slab, old tax regime</Typography>
    </Box>
  );
}

function CoverMock() {
  return (
    <Box sx={panel}>
      {[['Term life cover', '₹1 Cr'], ['Health cover', '₹10 L']].map(([k, v], i) => (
        <Stack key={k} direction="row" sx={{ alignItems: 'center', gap: 1.2, py: 0.8, borderTop: i ? '1px solid rgba(18,40,74,.08)' : 'none' }}>
          <ShieldIcon sx={{ color: i ? accent : navy, fontSize: 22 }} />
          <Typography sx={{ fontSize: 14, color: ink, flex: 1 }}>{k}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: ink }}>{v}</Typography>
        </Stack>
      ))}
    </Box>
  );
}

function GoalsMock() {
  return (
    <Box sx={panel}>
      {[["Child's education", 72, accent], ['Retirement', 38, navy]].map(([k, p, c], i) => (
        <Box key={k} sx={{ mt: i ? 1.5 : 0 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: ink }}>{k}</Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: ink }}>{p}%</Typography>
          </Stack>
          <Box sx={{ mt: 0.6, height: 6, borderRadius: 3, bgcolor: 'rgba(18,40,74,.08)', overflow: 'hidden' }}>
            <Box component={m.div} initial={{ width: 0 }} whileInView={{ width: `${p}%` }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }} sx={{ height: '100%', bgcolor: c }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function FamilyMock() {
  return (
    <Box sx={{ ...panel, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Stack direction="row">
        {[['P', navy], ['S', accent], ['K', gold]].map(([l, c], i) => (
          <Box key={l} sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: c, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, border: '3px solid #fff', ml: i ? -1.2 : 0 }}>{l}</Box>
        ))}
      </Stack>
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: ink }}>One family plan</Typography>
        <Typography sx={small}>Parents, children, the next generation</Typography>
      </Box>
    </Box>
  );
}

function IpoMock() {
  const steps = [['Applied', true], ['Allotted', true], ['Listed', false]];
  return (
    <Box sx={panel}>
      <Typography sx={small}>IPO application</Typography>
      <Stack direction="row" sx={{ mt: 1.2, alignItems: 'center' }}>
        {steps.map(([s, done], i) => (
          <Stack key={s} direction="row" sx={{ alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <Stack sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: done ? accent : '#fff', border: done ? 'none' : `2px solid rgba(18,40,74,.2)` }}>
                {done && <CheckIcon sx={{ color: '#fff', fontSize: 22 }} />}
              </Box>
              <Typography sx={{ fontSize: 11.5, mt: 0.5, color: done ? ink : 'text.secondary', fontWeight: 600 }}>{s}</Typography>
            </Stack>
            {i < steps.length - 1 && <Box sx={{ flex: 1, height: 2, mx: 0.5, mb: 2.5, bgcolor: steps[i + 1][1] ? accent : 'rgba(18,40,74,.15)' }} />}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

const services = [
  ['Mutual funds & SIP', 'The right funds for your goal, and a monthly plan you can keep. Tap an amount to try it.', SipMock],
  ['Stock advisory', 'Researched calls with a clear entry, exit and stop-loss, so you always know the plan.', CallMock],
  ['Portfolio management', 'Spread out, rebalanced and reported to you regularly.', MixMock],
  ['Tax planning', 'Save tax legally with ELSS and smart timing of gains.', TaxMock],
  ['Insurance advice', 'The cover you actually need, nothing extra.', CoverMock],
  ['Retirement & goals', 'Every goal gets its own path, and you can see the progress.', GoalsMock],
  ['Wealth management', 'How family money is split, passed on and protected.', FamilyMock],
  ['IPO, demat & trading', 'Account opening and IPO applications, tracked for you.', IpoMock],
];

// The same green stage as the hero, so the page reads as one product.
const stage = { position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg, #19B47F 0%, #0B7A53 55%, #075C3F 100%)' };
function StageDecor() {
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {[300, 480, 660].map((s) => <Box key={s} sx={{ position: 'absolute', right: -s / 3, top: -s / 3, width: s, height: s, borderRadius: '50%', border: '1px solid rgba(255,255,255,.14)' }} />)}
      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.2) 1px, transparent 1px)', backgroundSize: '18px 18px', maskImage: 'linear-gradient(to top, #000, transparent 70%)' }} />
    </Box>
  );
}

export default function Services() {
  const [active, setActive] = useState(0);
  const rows = useRef([]);
  // On desktop the row crossing the middle of the screen becomes the one shown on the stage.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(Number(e.target.dataset.i))), { rootMargin: '-45% 0px -45% 0px' });
    rows.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <Box id="services" component="section" sx={{ py: { xs: 10, md: 14 }, scrollMarginTop: 64 }}>
      <Container maxWidth="xl">
        <SectionHeading title="Everything your money needs, in one place" subtitle="From your first SIP to planning for the next generation, one team looks after all of it." />

        {/* Desktop: list on the left, live panel on a sticky stage on the right */}
        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '5fr 6fr', gap: { md: 6, lg: 10 }, alignItems: 'start' }}>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, py: '18vh' }}>
            {services.map(([t, d], i) => (
              <Box component="li" key={t} ref={(el) => { rows.current[i] = el; }} data-i={i} onMouseEnter={() => setActive(i)}
                sx={{ position: 'relative', py: 3, pl: 3, cursor: 'default', opacity: active === i ? 1 : 0.35, transition: 'opacity .3s' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 24, bottom: 24, width: 3, borderRadius: 2, bgcolor: active === i ? '#0B7A53' : 'rgba(18,40,74,.12)', transition: 'background-color .3s' }} />
                <Typography sx={{ fontSize: { md: 30, lg: 38 }, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: ink }}>{t}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1, fontSize: 16, lineHeight: 1.6, maxWidth: 460 }}>{d}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ position: 'sticky', top: 'calc(50vh - 290px)' }}>
            <Box sx={{ ...stage, height: 580, borderRadius: 8, display: 'grid', placeItems: 'center', p: { md: 4, lg: 6 } }}>
              <StageDecor />
              {/* every panel stays mounted in the same grid cell; switching is a CSS crossfade, so scrolling stays smooth */}
              {services.map(([t, , M], i) => (
                <Box key={t} aria-hidden={active !== i} sx={{ gridArea: '1 / 1', position: 'relative', width: '100%', maxWidth: 460,
                  opacity: active === i ? 1 : 0, transform: active === i ? 'none' : 'translateY(14px) scale(.98)', pointerEvents: active === i ? 'auto' : 'none',
                  transition: 'opacity .35s ease, transform .45s cubic-bezier(.22,1,.36,1)' }}>
                  <Box sx={{ p: 1.5, borderRadius: 6, bgcolor: 'rgba(255,255,255,.16)', boxShadow: '0 40px 80px -30px rgba(0,30,20,.55)' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 18, px: 1, pt: 0.5, pb: 1.5 }}>{t}</Typography>
                    <M />
                  </Box>
                </Box>
              ))}
              <Stack direction="row" spacing={0.75} sx={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }}>
                {services.map(([t], i) => (
                  <Box key={t} component="button" aria-label={t} onClick={() => setActive(i)}
                    sx={{ p: 0, border: 0, cursor: 'pointer', height: 6, borderRadius: 3, width: active === i ? 26 : 6, bgcolor: active === i ? '#fff' : 'rgba(255,255,255,.4)', transition: 'all .3s' }} />
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>

        {/* Phones and tablets: a swipeable row of cards */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1.5, overflowX: 'auto', scrollSnapType: 'x mandatory', mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 }, pb: 1,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {services.map(([t, d, M]) => (
            <Box key={t} sx={{ ...stage, flex: '0 0 86%', maxWidth: 420, scrollSnapAlign: 'center', borderRadius: 6, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <StageDecor />
              <Box sx={{ position: 'relative' }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>{t}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,.8)', mt: 0.5, fontSize: 14.5, lineHeight: 1.55 }}>{d}</Typography>
              </Box>
              <Box sx={{ position: 'relative', mt: 'auto' }}><M /></Box>
            </Box>
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: { md: 'none' }, mt: 1.5 }}>Swipe to see all {services.length} services</Typography>
      </Container>
    </Box>
  );
}
