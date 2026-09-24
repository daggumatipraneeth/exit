import { Box, Container, Typography } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import HandshakeIcon from '@mui/icons-material/HandshakeOutlined';
import GavelIcon from '@mui/icons-material/GavelOutlined';
import Reveal from '../components/Reveal';
import SectionHeading from '../components/SectionHeading';
import { accentBright, ink, navy } from '../theme';

const pillars = [
  [InsightsIcon, 'Research first', 'Every recommendation is backed by fundamental and technical research — never tips, never noise.'],
  [VisibilityIcon, 'Radical transparency', 'Clear fees, clear reasoning, clear reports. You always know what you own and why.'],
  [HandshakeIcon, 'A dedicated advisor', 'One person who knows your family and goals, available in person in Guntur and Hyderabad.'],
  [GavelIcon, 'Regulated & compliant', 'SEBI and AMFI registered, with processes built around investor protection.'],
];

const steps = ['Discover', 'Plan', 'Invest', 'Review'];

export default function Why() {
  return (
    <Box id="why" component="section" sx={{ position: 'relative', py: { xs: 10, md: 16 }, bgcolor: ink, color: '#fff', overflow: 'hidden', scrollMarginTop: 64 }}>
      <Box sx={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(${navy}, transparent 70%)` }} />
      <Box sx={{ position: 'absolute', bottom: '-30%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(${accentBright}22, transparent 65%)` }} />
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <SectionHeading light overline="Why Exit" title="Advice that knows when to enter — and when to exit" subtitle="A great exit is planned from day one. We build every portfolio with the end goal in sight." />

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {pillars.map(([Icon, title, text], i) => (
            <Reveal key={title} delay={i * 0.12} style={{ height: '100%' }}>
              <Box sx={{
                position: 'relative', p: { xs: 3, md: 4 }, height: '100%', borderRadius: 4, overflow: 'hidden',
                background: 'linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025))',
                border: '1px solid rgba(255,255,255,.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 30px 60px -40px rgba(0,0,0,.6)',
                transition: 'transform .5s cubic-bezier(.22,1,.36,1), border-color .4s, background .4s',
                '&::before': { content: '""', position: 'absolute', top: 0, left: 24, right: 24, height: '1px', background: `linear-gradient(90deg, transparent, ${accentBright}, transparent)`, opacity: 0, transition: 'opacity .4s' },
                '&:hover': { transform: 'translateY(-6px)', borderColor: 'rgba(52,211,153,.35)', background: 'linear-gradient(180deg, rgba(52,211,153,.10), rgba(255,255,255,.03))' },
                '&:hover::before': { opacity: 1 },
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.25)' }}>
                    <Icon sx={{ fontSize: 26, color: accentBright }} />
                  </Box>
                  <Typography sx={{ color: 'rgba(255,255,255,.3)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>0{i + 1}</Typography>
                </Box>
                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.68)', lineHeight: 1.8 }}>{text}</Typography>
              </Box>
            </Reveal>
          ))}
        </Box>

        <Reveal delay={0.2}>
          <Box sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, borderRadius: 5, border: '1px solid rgba(52,211,153,.3)', background: 'rgba(255,255,255,.03)' }}>
            <Typography variant="overline" sx={{ color: accentBright }}>Our process</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3, mt: 2, position: 'relative' }}>
              {steps.map((s, i) => (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `1px solid ${accentBright}`, color: accentBright, fontWeight: 600 }}>
                    {i + 1}
                  </Box>
                  <Typography sx={{ fontSize: { xs: 20, md: 24 } }}>{s}</Typography>
                  {i < steps.length - 1 && <Box sx={{ display: { xs: 'none', md: 'block' }, flex: 1, height: '1px', background: `linear-gradient(90deg, ${accentBright}, transparent)` }} />}
                </Box>
              ))}
            </Box>
          </Box>
        </Reveal>
      </Container>
    </Box>
  );
}
