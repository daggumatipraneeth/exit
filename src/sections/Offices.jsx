import { Box, Container, Typography, Stack, Button } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SectionHeading from '../components/SectionHeading';
import { company, offices, upcoming } from '../config';
import { accent, mist } from '../theme';

const rule = '1px solid rgba(18,40,74,.12)';
const link = { px: 0, minWidth: 0, fontWeight: 600, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } };

export default function Offices() {
  return (
    <Box id="offices" component="section" sx={{ py: { xs: 10, md: 16 }, scrollMarginTop: 64 }}>
      <Container maxWidth="xl">
        <SectionHeading title="Visit us in person" subtitle="Walk in for a conversation about your money. No appointment needed." />
        <Box sx={{ display: 'grid', gap: { xs: 3, md: 3 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' } }}>
          {offices.map((o) => (
            <Box key={o.city} sx={{ bgcolor: '#fff', borderRadius: 6, border: '1px solid rgba(18,40,74,.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px -40px rgba(10,24,48,.4)' }}>
              <Box component="iframe" title={`${o.city} office map`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(o.mapQuery)}&z=15&output=embed`}
                sx={{ display: 'block', border: 0, width: '100%', height: { xs: 200, md: 220 }, bgcolor: '#EEF1F0' }} />
              <Box sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="h3" sx={{ fontSize: { xs: 26, md: 28 } }}>{o.city}</Typography>
                  <Box sx={{ px: 1.2, py: 0.3, borderRadius: 99, fontSize: 12.5, fontWeight: 600, bgcolor: o.tag === 'Head Office' ? 'rgba(15,157,107,.1)' : mist, color: o.tag === 'Head Office' ? accent : 'text.secondary' }}>{o.tag}</Box>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>{o.address}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{o.hours}</Typography>
                <Stack direction="row" spacing={3} sx={{ mt: 'auto', pt: 2 }}>
                  <Button sx={link} target="_blank" rel="noopener noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.mapQuery)}`}>Get directions</Button>
                  <Button sx={link} href={`tel:${company.phone.replace(/\s/g, '')}`}>Call</Button>
                </Stack>
              </Box>
            </Box>
          ))}
        </Box>

        {upcoming.map((city) => (
          <Box key={city} sx={{ mt: 3, p: { xs: 2.5, md: 3 }, borderRadius: 6, border: '1.5px dashed rgba(11,122,83,.35)', bgcolor: 'rgba(15,157,107,.04)', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: { xs: 1.5, md: 4 } }}>
            <Typography variant="h3" sx={{ fontSize: { xs: 26, md: 28 } }}>{city}</Typography>
            <Typography color="text.secondary" sx={{ flex: 1 }}><Box component="b" sx={{ color: accent, fontWeight: 600 }}>Opening soon.</Box> Message us and we'll tell you the day it opens.</Typography>
            <Button variant="outlined" startIcon={<WhatsAppIcon />} target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(`Hi Exit team, please let me know when the ${city} office opens.`)}`}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0, borderColor: 'rgba(18,40,74,.25)' }}>
              Tell me when it opens
            </Button>
          </Box>
        ))}
      </Container>
    </Box>
  );
}
