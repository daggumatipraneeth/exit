import { Box, Container, Typography, Stack, Button, Chip } from '@mui/material';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import DirectionsIcon from '@mui/icons-material/Directions';
import Reveal from '../components/Reveal';
import SectionHeading from '../components/SectionHeading';
import { offices } from '../config';
import { accent, navy } from '../theme';

export default function Offices() {
  return (
    <Box id="offices" component="section" sx={{ py: { xs: 10, md: 16 }, scrollMarginTop: 64 }}>
      <Container maxWidth="lg">
        <SectionHeading overline="Visit us" title="Two cities. One standard of care." subtitle="Walk in for a coffee and a conversation about your money — no appointment needed." />
        <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {offices.map((o, i) => (
            <Reveal key={o.city} delay={i * 0.15}>
              <Box sx={{ borderRadius: 5, overflow: 'hidden', bgcolor: '#fff', border: '1px solid rgba(18,40,74,.08)', transition: 'all .5s cubic-bezier(.22,1,.36,1)',
                '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 40px 80px -40px rgba(18,40,74,.4)' },
                '&:hover iframe': { filter: 'grayscale(0) contrast(1)' } }}>
                <Box sx={{ position: 'relative', height: 240 }}>
                  <Box component="iframe" title={`${o.city} office map`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(o.mapQuery)}&z=14&output=embed`}
                    sx={{ border: 0, width: '100%', height: '100%', filter: 'grayscale(1) contrast(1.1)', transition: 'filter .6s' }} />
                  <Chip label={o.tag} size="small" sx={{ position: 'absolute', top: 16, left: 16, bgcolor: navy, color: '#fff', fontWeight: 600 }} />
                </Box>
                <Box sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 36 } }}>{o.city}</Typography>
                  <Box sx={{ width: 32, height: 2, bgcolor: accent, my: 2 }} />
                  <Stack spacing={1.6}>
                    {[[PlaceIcon, o.address], [PhoneIcon, o.phone], [ScheduleIcon, o.hours]].map(([Icon, t]) => (
                      <Stack sx={{ alignItems: "flex-start" }} key={t} direction="row" spacing={1.5}>
                        <Icon fontSize="small" sx={{ color: accent, mt: '2px' }} />
                        <Typography sx={{ lineHeight: 1.7 }} variant="body2" color="text.secondary">{t}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                    <Button variant="outlined" startIcon={<DirectionsIcon />} target="_blank" rel="noopener noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.mapQuery)}`}>Directions</Button>
                    <Button href={`tel:${o.phone.replace(/\s/g, '')}`} startIcon={<PhoneIcon />}>Call</Button>
                  </Stack>
                </Box>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
