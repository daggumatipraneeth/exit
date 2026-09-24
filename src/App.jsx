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
  return (
    <>
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
