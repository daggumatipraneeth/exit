import { Box, Container, Typography } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChartOutlined';
import ShieldIcon from '@mui/icons-material/ShieldOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import BeachIcon from '@mui/icons-material/BeachAccessOutlined';
import RocketIcon from '@mui/icons-material/RocketLaunchOutlined';
import DiamondIcon from '@mui/icons-material/DiamondOutlined';
import ArrowIcon from '@mui/icons-material/ArrowOutward';
import Reveal from '../components/Reveal';
import SectionHeading from '../components/SectionHeading';
import { accent, accentSoft, navy } from '../theme';

const services = [
  [ShowChartIcon, 'Stock Advisory', 'Research-driven equity calls, entry & exit levels, and disciplined risk management for every market cycle.'],
  [AccountBalanceIcon, 'Mutual Fund Advisory', 'Handpicked funds, SIP planning and periodic reviews aligned to your goals and risk appetite.'],
  [PieChartIcon, 'Portfolio Management', 'Diversified, rebalanced portfolios with transparent reporting and regular performance reviews.'],
  [DiamondIcon, 'Wealth Management', 'Holistic planning for HNI families — asset allocation, succession and legacy structuring.'],
  [BeachIcon, 'Retirement & Goal Planning', "Map every milestone — a home, your child's education, retirement — to a clear investment path."],
  [ReceiptIcon, 'Tax Planning', 'ELSS, capital-gains harvesting and tax-efficient structures that keep more of your returns.'],
  [ShieldIcon, 'Insurance Advisory', 'Right-sized term, health and wealth-protection cover — independent and needs-based.'],
  [RocketIcon, 'IPO, Demat & Trading', 'Seamless account opening, IPO applications and trading support backed by real people.'],
];

// Card with a cursor-following accent spotlight and a sweeping top border.
function ServiceCard({ Icon, title, text }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
  };
  return (
    <Box
      onMouseMove={onMove}
      sx={{
        position: 'relative', height: '100%', p: 4, borderRadius: 4, bgcolor: '#fff', overflow: 'hidden',
        border: '1px solid rgba(18,40,74,.08)', transition: 'transform .5s cubic-bezier(.22,1,.36,1), box-shadow .5s',
        '&::before': {
          content: '""', position: 'absolute', inset: 0, opacity: 0, transition: 'opacity .4s',
          background: `radial-gradient(360px circle at var(--x) var(--y), ${accentSoft}40, transparent 45%)`,
        },
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: accent,
          transform: 'scaleX(0)', transformOrigin: 'left', transition: 'transform .6s cubic-bezier(.22,1,.36,1)',
        },
        '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 30px 60px -30px rgba(18,40,74,.35)' },
        '&:hover::before': { opacity: 1 },
        '&:hover::after': { transform: 'scaleX(1)' },
        '&:hover .icon': { bgcolor: navy, color: accent, transform: 'rotate(-6deg) scale(1.05)' },
        '&:hover .arrow': { opacity: 1, transform: 'translate(0,0)' },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <Box className="icon" sx={{ width: 56, height: 56, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'rgba(18,40,74,.06)', color: navy, transition: 'all .5s' }}>
          <Icon />
        </Box>
        <ArrowIcon className="arrow" sx={{ position: 'absolute', top: 0, right: 0, color: accent, opacity: 0, transform: 'translate(-6px,6px)', transition: 'all .4s' }} />
        <Typography variant="h6" sx={{ mt: 3, mb: 1.2 }}>{title}</Typography>
        <Typography sx={{ lineHeight: 1.75 }} variant="body2" color="text.secondary">{text}</Typography>
      </Box>
    </Box>
  );
}

export default function Services() {
  return (
    <Box id="services" component="section" sx={{ py: { xs: 10, md: 16 }, scrollMarginTop: 64 }}>
      <Container maxWidth="lg">
        <SectionHeading
          overline="What we do"
          title="Every financial decision, under one trusted roof"
          subtitle="From your first SIP to multi-generational wealth — advice that is personal, researched and always in your interest."
        />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {services.map(([Icon, title, text], i) => (
            <Reveal key={title} delay={(i % 4) * 0.08} style={{ height: '100%' }}>
              <ServiceCard Icon={Icon} title={title} text={text} />
            </Reveal>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
