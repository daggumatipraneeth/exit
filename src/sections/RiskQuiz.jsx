import { useState } from 'react';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { AnimatePresence, m } from 'framer-motion';
import SectionHeading from '../components/SectionHeading';
import { accent, ink, mist, navy } from '../theme';

const questions = [
  ['How long do you plan to stay invested?', ['Less than 3 years', '3 to 7 years', 'More than 7 years']],
  ['Your investments fall 20% in a month. You…', ['Sell to stop the loss', 'Hold and wait', 'Invest more at the lower price']],
  ['What matters most to you?', ['Keeping my money safe', 'Steady, balanced growth', 'The most growth over the long run']],
  ['How much investing have you done?', ['I am new to it', 'Some mutual funds or FDs', 'I have bought stocks for years']],
];

const profiles = {
  Careful: { mix: [['Stocks', 25], ['Bonds & debt', 60], ['Gold', 15]], text: 'Keeping your money safe comes first. Mostly debt, with a small share in stocks to beat inflation.' },
  Balanced: { mix: [['Stocks', 55], ['Bonds & debt', 32], ['Gold', 13]], text: 'A steady core of stock funds, cushioned by quality debt and a little gold.' },
  Growth: { mix: [['Stocks', 80], ['Bonds & debt', 12], ['Gold', 8]], text: 'Built for growth over many years, for people who can sit through the ups and downs.' },
};
const colors = [navy, accent, '#C9A54B'];

export default function RiskQuiz() {
  const [answers, setAnswers] = useState([]);
  const step = answers.length;
  const done = step === questions.length;
  const score = answers.reduce((a, b) => a + b, 0); // 0..8
  const profile = score <= 2 ? 'Careful' : score <= 5 ? 'Balanced' : 'Growth';

  return (
    <Box id="risk" component="section" sx={{ py: { xs: 10, md: 16 }, bgcolor: mist, scrollMarginTop: 64 }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '5fr 7fr' }, gap: { xs: 0, md: 10 } }}>
          <SectionHeading title="What kind of investor are you?" subtitle="Four quick questions. You'll get your risk profile and a suggested mix of investments." />
          <Box sx={{ bgcolor: '#fff', borderRadius: 6, boxShadow: '0 40px 80px -40px rgba(10,24,48,.4)', p: { xs: 3, md: 5 }, minHeight: { md: 420 } }}>
            {/* progress: one segment per question */}
            <Stack direction="row" spacing={0.75} sx={{ mb: 4 }}>
              {questions.map((_, i) => <Box key={i} sx={{ flex: 1, height: 6, borderRadius: 2, bgcolor: i < step ? accent : 'rgba(18,40,74,.12)', transition: 'background-color .3s' }} />)}
            </Stack>
            <AnimatePresence mode="wait">
              {!done ? (
                <m.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
                  <Typography variant="body2" color="text.secondary">Question {step + 1} of {questions.length}</Typography>
                  <Typography variant="h3" sx={{ mt: 1, mb: 3, fontSize: { xs: 22, md: 28 } }}>{questions[step][0]}</Typography>
                  <Stack spacing={1.25}>
                    {questions[step][1].map((opt, i) => (
                      <Button key={opt} onClick={() => setAnswers([...answers, i])} fullWidth
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 2, px: 2.5, borderRadius: 4, color: ink, fontWeight: 500, fontSize: 16,
                          bgcolor: mist, border: '1px solid transparent', '&:hover': { borderColor: '#0B7A53', bgcolor: 'rgba(15,157,107,.06)' } }}>
                        <Box component="span" sx={{ width: 18, height: 18, mr: 2, borderRadius: '50%', border: '1.5px solid rgba(18,40,74,.35)', flexShrink: 0 }} />
                        {opt}
                      </Button>
                    ))}
                  </Stack>
                  {step > 0 && <Button size="small" onClick={() => setAnswers(answers.slice(0, -1))} sx={{ mt: 2, px: 0, color: 'text.secondary' }}>Back</Button>}
                </m.div>
              ) : (
                <m.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                  <Typography variant="body2" color="text.secondary">Your profile</Typography>
                  <Typography variant="h3" sx={{ fontSize: { xs: 34, md: 44 }, mt: 0.5 }}>{profile}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7, maxWidth: 480 }}>{profiles[profile].text}</Typography>
                  {/* suggested mix as one stacked bar */}
                  <Box sx={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', mt: 4, gap: '3px' }}>
                    {profiles[profile].mix.map(([k, v], i) => (
                      <Box key={k} component={m.div} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }} sx={{ bgcolor: colors[i] }} />
                    ))}
                  </Box>
                  <Stack direction="row" spacing={3} sx={{ mt: 2, mb: 4, flexWrap: 'wrap', rowGap: 1 }}>
                    {profiles[profile].mix.map(([k, v], i) => (
                      <Stack key={k} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: colors[i] }} />
                        <Typography variant="body2" color="text.secondary">{k}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{v}%</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button variant="contained" href="#contact">Talk to an advisor</Button>
                    <Button startIcon={<ReplayIcon />} onClick={() => setAnswers([])}>Start again</Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
                    A rough guide, not investment advice. We do a full risk check during your consultation.
                  </Typography>
                </m.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
