import { Box } from '@mui/material';
import { motion, useScroll, useSpring } from 'framer-motion';
import { accent } from './theme';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Services from './sections/Services';
import Why from './sections/Why';
import SipCalculator from './sections/SipCalculator';
import RiskQuiz from './sections/RiskQuiz';
import Offices from './sections/Offices';
import Contact from './sections/Contact';
import Footer from './sections/Footer';
import FloatingActions from './components/FloatingActions';

export default function App() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <>
      <Box
        component={motion.div}
        style={{ scaleX }}
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 3, bgcolor: accent, transformOrigin: '0%', zIndex: 2000 }}
      />
      <Nav />
      <main>
        <Hero />
        <Services />
        <Why />
        <SipCalculator />
        <RiskQuiz />
        <Offices />
        <Contact />
      </main>
      <Footer />
      <FloatingActions />
    </>
  );
}
