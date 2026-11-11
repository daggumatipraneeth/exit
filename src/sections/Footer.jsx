import { Box, Container, Typography, Stack, Link, Divider } from '@mui/material';
import { company, offices } from '../config';
import { links } from './Nav';
import { accent, ink } from '../theme';

export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: '#fff', color: 'text.secondary', borderTop: '1px solid rgba(18,40,74,.12)', pt: { xs: 8, md: 12 }, pb: { xs: 14, sm: 5 } }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'grid', gap: 6, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.6fr 1fr 1fr 1fr 1fr' } }}>
          <Box>
            <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: 44 }} />
            <Typography variant="body2" sx={{ mt: 2.5, maxWidth: 320, lineHeight: 1.8 }}>{company.tagline}</Typography>
            <Typography variant="caption" component="p" sx={{ mt: 2, color: 'text.secondary' }}>{company.name}</Typography>
            <Link href="#contact" underline="none" sx={{ display: 'block', mt: 2.5, color: ink, fontSize: 20, fontWeight: 600, lineHeight: 1.5, '&:hover': { color: accent } }}>
              {company.phone}<Box component="span" sx={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{company.email}</Box>
            </Link>
          </Box>
          <Box>
            <Typography sx={{ color: ink, fontWeight: 600 }}>Explore</Typography>
            <Stack spacing={1.2} sx={{ mt: 1 }}>
              {links.map(([l, h]) => <Link key={h} href={h} underline="hover" color="inherit" variant="body2">{l}</Link>)}
            </Stack>
          </Box>
          {offices.map((o) => (
            <Box key={o.city}>
              <Typography sx={{ color: ink, fontWeight: 600 }}>{o.city}</Typography>
              <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.8 }}>{o.address}</Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 5, borderColor: 'rgba(18,40,74,.1)' }} />

        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', opacity: 0.8, lineHeight: 1.8 }}>
          Investments in securities market are subject to market risks. Read all the related documents carefully before investing.
          Mutual fund investments are subject to market risks; read all scheme-related documents carefully.
          We do not provide any assurance of returns.
          Past performance is not indicative of future returns. Portfolio figures and projections shown on this site are illustrative.
        </Typography>
        <Stack direction="row" sx={{ mt: 3, gap: 3, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href="#/terms" color="inherit" underline="hover">Terms of use</Link>
          <Link href="#/privacy" color="inherit" underline="hover">Privacy policy</Link>
          <Link href="#/risk" color="inherit" underline="hover">Risk disclosure</Link>
        </Stack>
        <Typography variant="caption" component="p" sx={{ mt: 2, color: 'text.secondary' }}>
          © {new Date().getFullYear()} {company.name}. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
