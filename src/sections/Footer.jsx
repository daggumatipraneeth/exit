import { Box, Container, Typography, Stack, Link, Divider } from '@mui/material';
import { company, offices } from '../config';
import { links } from './Nav';
import { accentBright, ink } from '../theme';

export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: ink, color: 'rgba(255,255,255,.7)', pt: { xs: 8, md: 12 }, pb: 5 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gap: 6, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr 1fr' } }}>
          <Box>
            <Box component="img" src="media/Exit256.png" alt="Exit" sx={{ height: 44, filter: 'brightness(0) invert(1)' }} />
            <Typography variant="body2" sx={{ mt: 2.5, maxWidth: 320, lineHeight: 1.8 }}>{company.tagline}</Typography>
            <Typography variant="caption" component="p" sx={{ mt: 2, color: 'rgba(255,255,255,.5)' }}>{company.name}</Typography>
          </Box>
          <Box>
            <Typography variant="overline" sx={{ color: accentBright }}>Explore</Typography>
            <Stack spacing={1.2} sx={{ mt: 1.5 }}>
              {links.map(([l, h]) => <Link key={h} href={h} underline="hover" color="inherit" variant="body2">{l}</Link>)}
            </Stack>
          </Box>
          {offices.map((o) => (
            <Box key={o.city}>
              <Typography variant="overline" sx={{ color: accentBright }}>{o.city}</Typography>
              <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.8 }}>{o.address}</Typography>
              <Link href={`tel:${o.phone.replace(/\s/g, '')}`} color="inherit" variant="body2" underline="hover">{o.phone}</Link>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 5, borderColor: 'rgba(255,255,255,.08)' }} />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 4 }} sx={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
          <span>SEBI Reg. No.: {company.sebiReg}</span>
          <span>AMFI ARN: {company.amfiArn}</span>
          <span>CIN: {company.cin}</span>
        </Stack>
        <Typography variant="caption" component="p" sx={{ mt: 2.5, color: 'rgba(255,255,255,.45)', lineHeight: 1.8 }}>
          Investments in securities market are subject to market risks. Read all the related documents carefully before investing.
          Mutual fund investments are subject to market risks; read all scheme-related documents carefully. Registration granted by SEBI
          and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.
          Past performance is not indicative of future returns. Portfolio figures and projections shown on this site are illustrative.
        </Typography>
        <Typography variant="caption" component="p" sx={{ mt: 3, color: 'rgba(255,255,255,.4)' }}>
          © {new Date().getFullYear()} {company.name}. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
