import { Box, Container, Typography, Button, Stack, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import MarketCanvas from '../components/MarketCanvas';
import Stats from './Stats';
import { accent, accentSoft, ink, bg, navy } from '../theme';

const ease = [0.22, 1, 0.36, 1];
const headline = [['Build', 'wealth', 'with'], ['clarity.', 'Exit', 'with'], ['confidence.']];
const highlight = new Set(['clarity.', 'confidence.']);

const alloc = [['Equity', 58, accent], ['Debt', 27, '#8FA6CC'], ['Gold', 15, '#C7D2E3']];

function PortfolioCard() {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 150, damping: 18 });
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const leave = () => { mx.set(0); my.set(0); };

  return (
    <Box sx={{ perspective: 1200 }} onMouseMove={move} onMouseLeave={leave}>
      <Box
        component={motion.div}
        style={{ rotateX: rx, rotateY: ry }}
        initial={{ opacity: 0, y: 60, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.4, ease }}
        sx={{
          position: 'relative', p: { xs: 3, md: 4 }, borderRadius: 5, color: '#fff',
          background: `linear-gradient(145deg, ${navy} 0%, ${ink} 100%)`,
          boxShadow: '0 40px 80px -30px rgba(10,24,48,.55), inset 0 1px 0 rgba(255,255,255,.08)',
          transformStyle: 'preserve-3d', overflow: 'hidden',
          '&::before': {
            content: '""', position: 'absolute', inset: 0, borderRadius: 'inherit', padding: '1px',
            background: `linear-gradient(135deg, ${accentSoft}, transparent 40%, transparent 60%, ${accent})`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ position: 'absolute', top: -80, right: -80, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(${accent}55, transparent 70%)` }} />
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", transform: 'translateZ(30px)' }}>
          <Typography variant="overline" sx={{ color: accentSoft, lineHeight: 1 }}>Model portfolio**</Typography>
        </Stack>
        <Typography sx={{ fontSize: { xs: 32, md: 40 }, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', mt: 2, transform: 'translateZ(50px)' }}>
          ₹24,86,310
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: '#6EE7B7', transform: 'translateZ(40px)' }}>
          <TrendingUpIcon fontSize="small" />
          <Typography sx={{ fontWeight: 600 }} variant="body2">+18.4% · 12 months</Typography>
        </Stack>

        <Box component="svg" viewBox="0 0 300 80" sx={{ width: '100%', height: 80, mt: 3, overflow: 'visible' }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity=".35" />
              <stop offset="1" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d="M0 64 L30 58 L60 62 L90 48 L120 52 L150 38 L180 42 L210 26 L240 30 L270 14 L300 8 L300 80 L0 80Z"
            fill="url(#spark)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}
          />
          <motion.path
            d="M0 64 L30 58 L60 62 L90 48 L120 52 L150 38 L180 42 L210 26 L240 30 L270 14 L300 8"
            fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 1.8, ease }}
          />
        </Box>

        <Box sx={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', mt: 3, bgcolor: 'rgba(255,255,255,.08)' }}>
          {alloc.map(([k, v, c], i) => (
            <Box key={k} component={motion.div} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ delay: 1.4 + i * 0.15, duration: 1, ease }}
              sx={{ bgcolor: c }} />
          ))}
        </Box>
        <Stack direction="row" spacing={2.5} sx={{ mt: 1.5 }}>
          {alloc.map(([k, v, c]) => (
            <Stack sx={{ alignItems: "center" }} key={k} direction="row" spacing={0.8}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.7)' }}>{k} {v}%</Typography>
            </Stack>
          ))}
        </Stack>
        <Typography sx={{ mt: 2.5, textAlign: 'right', fontSize: 10.5, color: 'rgba(255,255,255,.45)' }}>** Illustrative figures</Typography>
      </Box>

      <Box
        component={motion.div}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.6, ease }}
        sx={{
          position: 'absolute', left: { xs: 12, md: -40 }, bottom: { xs: -36, md: -44 }, px: 2, py: 1.5, borderRadius: 3,
          bgcolor: '#fff', boxShadow: '0 20px 40px -20px rgba(10,24,48,.35)',
          display: 'flex', gap: 1.5, alignItems: 'center',
        }}
      >
        <VerifiedIcon sx={{ color: accent }} />
        <Box>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} variant="body2">Goal on track</Typography>
          <Typography variant="caption" color="text.secondary">Child education · 2034</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function Hero() {
  let wi = 0;
  return (
    <Box id="top" component="section" sx={{ position: 'relative', overflow: 'hidden', bgcolor: bg, minHeight: '100svh', display: 'flex', flexDirection: 'column', pt: { xs: 13, md: 14 }, pb: { xs: 4, md: 5 } }}>
      <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 50% at 85% 20%, ${accentSoft}55, transparent 70%), radial-gradient(50% 50% at 0% 100%, #D9E2F0, transparent 70%)` }} />
      <Box sx={{ position: 'absolute', top: '30%', left: 0, right: 0, bottom: 0 }}>
        <MarketCanvas />
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(18,40,74,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(18,40,74,.04) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(ellipse at center, #000 20%, transparent 75%)' }} />

      <Container maxWidth="lg" sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr .85fr' }, gap: { xs: 8, md: 6 }, alignItems: 'center', flex: 1, pb: { xs: 8, md: 6 } }}>
          <Box>
            <Chip
              component={motion.div}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
              icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: '10px !important', boxShadow: '0 0 0 4px rgba(15,157,107,.18)' }} />}
              label="SEBI-registered advisory · Guntur & Hyderabad"
              sx={{ bgcolor: '#fff', border: '1px solid rgba(18,40,74,.1)', fontWeight: 500, mb: 3, height: 34 }}
            />
            <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '2.9rem', sm: '3.8rem', md: '4.6rem' } }}>
              {headline.map((line, li) => (
                <Box key={li} component="span" sx={{ display: 'block' }}>
                  {line.map((w) => {
                    const d = 0.1 + wi++ * 0.05;
                    return (
                      <Box key={w} component="span" sx={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', mr: '0.22em', pb: '0.08em' }}>
                        <Box
                          component={motion.span}
                          initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: d, ease }}
                          sx={{ display: 'inline-block', ...(highlight.has(w) && { color: accent, background: `linear-gradient(100deg, ${accent}, #0B7A53 60%, ${accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }) }}
                        >
                          {w}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Typography>
            <Typography
              component={motion.p}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease }}
              sx={{ mt: 3, maxWidth: 540, color: 'text.secondary', fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.7 }}
            >
              Research-backed stock advisory, mutual fund planning and complete wealth management — from people who know your city, your goals and your family.
            </Typography>
            <Stack
              component={motion.div}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6, ease }}
              direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 5 }}
            >
              <Button size="large" variant="contained" href="#contact" endIcon={<ArrowForwardIcon />}
                sx={{ py: 1.7, px: 4, boxShadow: '0 16px 32px -14px rgba(18,40,74,.6)', '&:hover .MuiButton-endIcon': { transform: 'translateX(4px)' }, '.MuiButton-endIcon': { transition: 'transform .3s' } }}>
                Book a free consultation
              </Button>
              <Button size="large" variant="outlined" href="#calculator" sx={{ py: 1.7, px: 4, borderColor: 'rgba(18,40,74,.25)', bgcolor: 'rgba(255,255,255,.6)' }}>
                Plan my SIP
              </Button>
            </Stack>
          </Box>
          <Box sx={{ position: 'relative', maxWidth: 440, width: '100%', mx: 'auto' }}>
            <PortfolioCard />
          </Box>
        </Box>
        <Stats />
      </Container>
    </Box>
  );
}
