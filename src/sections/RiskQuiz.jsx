import { useState } from 'react';
import { Box, Container, Typography, Button, LinearProgress, Stack } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { AnimatePresence, motion } from 'framer-motion';
import Reveal from '../components/Reveal';
import SectionHeading from '../components/SectionHeading';
import { accent, accentSoft, ink, navy } from '../theme';

const questions = [
  ['How long do you plan to stay invested?', ['Less than 3 years', '3 – 7 years', 'More than 7 years']],
  ['Your portfolio falls 20% in a month. You…', ['Sell to stop the loss', 'Hold and wait', 'Invest more at lower prices']],
  ['What matters most to you?', ['Protecting my capital', 'Balanced, steady growth', 'Maximum long-term growth']],
  ['How much investing experience do you have?', ['New to investing', 'Some mutual funds / FDs', 'Active in stocks for years']],
];

const profiles = {
  Conservative: { mix: [['Equity', 25], ['Debt', 60], ['Gold', 15]], text: 'Capital preservation first. Debt-heavy mix with a measured equity sleeve for inflation-beating growth.' },
  Moderate: { mix: [['Equity', 55], ['Debt', 32], ['Gold', 13]], text: 'A balanced core of diversified equity funds, cushioned by quality debt and a gold hedge.' },
  Aggressive: { mix: [['Equity', 80], ['Debt', 12], ['Gold', 8]], text: 'Growth-oriented with large, mid and small-cap exposure — for long horizons and strong nerves.' },
};
const colors = [navy, accent, '#A9B8D0'];

function Donut({ mix }) {
  const r = 70, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Box component="svg" viewBox="0 0 200 200" sx={{ width: { xs: 180, md: 220 }, transform: 'rotate(-90deg)' }}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(18,40,74,.06)" strokeWidth="26" />
      {mix.map(([k, v], i) => {
        const len = (v / 100) * c, off = acc;
        acc += len;
        return (
          <motion.circle key={k} cx="100" cy="100" r={r} fill="none" stroke={colors[i]} strokeWidth="26"
            strokeDasharray={`${len - 2} ${c}`}
            initial={{ strokeDashoffset: -off + len, opacity: 0 }}
            animate={{ strokeDashoffset: -off, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
        );
      })}
    </Box>
  );
}

export default function RiskQuiz() {
  const [answers, setAnswers] = useState([]);
  const step = answers.length;
  const done = step === questions.length;
  const score = answers.reduce((a, b) => a + b, 0); // 0..8
  const profile = score <= 2 ? 'Conservative' : score <= 5 ? 'Moderate' : 'Aggressive';

  return (
    <Box id="risk" component="section" sx={{ py: { xs: 10, md: 16 }, bgcolor: '#F7F9F8', scrollMarginTop: 64 }}>
      <Container maxWidth="md">
        <SectionHeading overline="60-second check" title="What kind of investor are you?" subtitle="Answer four quick questions to discover your risk profile and a suggested asset mix." />
        <Reveal>
          <Box sx={{ position: 'relative', bgcolor: '#fff', borderRadius: 5, p: { xs: 3, md: 6 }, minHeight: 380, boxShadow: '0 40px 80px -50px rgba(18,40,74,.45)', overflow: 'hidden' }}>
            <LinearProgress variant="determinate" value={(step / questions.length) * 100}
              sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: 'rgba(18,40,74,.06)', '& .MuiLinearProgress-bar': { bgcolor: accent } }} />
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                  <Typography variant="overline" color="text.secondary">Question {step + 1} of {questions.length}</Typography>
                  <Typography variant="h4" sx={{ mt: 1, mb: 4, fontSize: { xs: 24, md: 32 } }}>{questions[step][0]}</Typography>
                  <Stack spacing={1.5}>
                    {questions[step][1].map((opt, i) => (
                      <Button key={opt} onClick={() => setAnswers([...answers, i])} fullWidth
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 2, px: 3, borderRadius: 3, color: ink, fontWeight: 500, fontSize: 16,
                          border: '1px solid rgba(18,40,74,.12)', transition: 'all .3s',
                          '&:hover': { borderColor: accent, bgcolor: `${accentSoft}33`, transform: 'translateX(6px)' } }}>
                        <Box component="span" sx={{ width: 30, height: 30, mr: 2, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(18,40,74,.06)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {String.fromCharCode(65 + i)}
                        </Box>
                        {opt}
                      </Button>
                    ))}
                  </Stack>
                  {step > 0 && <Button size="small" onClick={() => setAnswers(answers.slice(0, -1))} sx={{ mt: 3, color: 'text.secondary' }}>← Back</Button>}
                </motion.div>
              ) : (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, gap: { xs: 3, md: 6 }, alignItems: 'center', justifyItems: { xs: 'center', md: 'start' } }}>
                    <Donut mix={profiles[profile].mix} />
                    <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                      <Typography variant="overline" sx={{ color: accent }}>Your profile</Typography>
                      <Typography variant="h3" sx={{ fontSize: { xs: 34, md: 44 } }}>{profile}</Typography>
                      <Typography color="text.secondary" sx={{ mt: 1.5, mb: 3, lineHeight: 1.7 }}>{profiles[profile].text}</Typography>
                      <Stack direction="row" spacing={2.5} sx={{ justifyContent: { xs: 'center', md: 'flex-start' }, mb: 4 }}>
                        {profiles[profile].mix.map(([k, v], i) => (
                          <Box key={k}>
                            <Stack sx={{ alignItems: "center" }} direction="row" spacing={0.8}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[i] }} />
                              <Typography variant="caption" color="text.secondary">{k}</Typography>
                            </Stack>
                            <Typography sx={{ fontWeight: 700 }}>{v}%</Typography>
                          </Box>
                        ))}
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <Button variant="contained" href="#contact">Talk to an advisor</Button>
                        <Button startIcon={<ReplayIcon />} onClick={() => setAnswers([])}>Retake</Button>
                      </Stack>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 4, textAlign: 'center' }}>
                    Indicative only — not investment advice. A detailed risk profiling is done during your consultation.
                  </Typography>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Reveal>
      </Container>
    </Box>
  );
}
