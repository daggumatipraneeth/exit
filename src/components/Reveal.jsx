import { useEffect, useRef, useState } from 'react';

// Fades + lifts children in once when scrolled into view.
// Plain CSS transitions (compositor-driven), so it stays smooth on slow phones.
export default function Reveal({ children, delay = 0, y = 24, style }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -40px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const ease = `.6s ${delay}s cubic-bezier(.22,1,.36,1)`;
  return (
    <div
      ref={ref}
      style={{ ...style, opacity: shown ? 1 : 0, transform: shown ? 'none' : `translateY(${y}px)`, transition: `opacity ${ease}, transform ${ease}` }}
    >
      {children}
    </div>
  );
}
