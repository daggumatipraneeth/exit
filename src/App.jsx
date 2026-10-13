import { useEffect, useState } from 'react';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Services from './sections/Services';
import Why from './sections/Why';
import SipCalculator from './sections/SipCalculator';
import RiskQuiz from './sections/RiskQuiz';
import Offices from './sections/Offices';
import Contact from './sections/Contact';
import Footer from './sections/Footer';
import Legal, { legalDocs } from './sections/Legal';
import FloatingActions from './components/FloatingActions';

// #/terms, #/privacy and #/risk show a legal page; any other hash is a section of the home page.
function useLegalPage() {
  const read = () => window.location.hash.replace(/^#\//, '');
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onChange = () => {
      const next = read();
      setPage(next);
      if (legalDocs[next]) window.scrollTo(0, 0);
      // Coming back from a legal page: the section only exists after this render, so scroll to it then.
      else requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView());
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return legalDocs[page] ? page : null;
}

export default function App() {
  const legal = useLegalPage();
  return (
    <>
      <Nav />
      {legal ? <Legal doc={legal} /> : (
        <main>
          <Hero />
          <Services />
          <Why />
          <SipCalculator />
          <RiskQuiz />
          <Offices />
          <Contact />
        </main>
      )}
      <Footer />
      <FloatingActions />
    </>
  );
}
