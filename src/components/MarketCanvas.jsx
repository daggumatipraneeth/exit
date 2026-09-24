import { useEffect, useRef } from 'react';

// Ambient, endlessly-scrolling market chart: faint candles + a glowing accent trend line.
export default function MarketCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STEP = 18;
    let w = 0, h = 0, raf = 0, offset = 0, reveal = 0, frame = 0, running = false;
    let small = false; // phones: fewer pixels, 30fps
    let pts = [];

    const next = (last) => last + (Math.random() - 0.4) * 0.05; // gentle upward drift
    const seed = () => {
      const n = Math.ceil(w / STEP) + 4;
      pts = [0.25];
      for (let i = 1; i < n; i++) pts.push(next(pts[i - 1]));
    };
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      small = w < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const min = Math.min(...pts), max = Math.max(...pts);
      const y = (v) => h * 0.88 - ((v - min) / Math.max(max - min, 0.6)) * h * 0.62;
      const x = (i) => i * STEP - offset;
      const shown = Math.floor(pts.length * reveal);

      // candles
      for (let i = 1; i < shown; i++) {
        const up = pts[i] >= pts[i - 1];
        ctx.fillStyle = up ? 'rgba(18,40,74,.07)' : 'rgba(18,40,74,.04)';
        const top = y(Math.max(pts[i], pts[i - 1])), bot = y(Math.min(pts[i], pts[i - 1]));
        ctx.fillRect(x(i) - 3, top, 6, Math.max(2, bot - top));
        ctx.fillRect(x(i) - 0.5, top - 8, 1, bot - top + 16);
      }
      if (shown < 2) return;

      // area
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(15,157,107,.22)');
      grad.addColorStop(1, 'rgba(15,157,107,0)');
      ctx.beginPath();
      ctx.moveTo(x(0), y(pts[0]));
      for (let i = 1; i < shown; i++) ctx.lineTo(x(i), y(pts[i]));
      ctx.lineTo(x(shown - 1), h); ctx.lineTo(x(0), h); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      // line
      ctx.beginPath();
      ctx.moveTo(x(0), y(pts[0]));
      for (let i = 1; i < shown; i++) ctx.lineTo(x(i), y(pts[i]));
      ctx.strokeStyle = 'rgba(15,157,107,.18)'; ctx.lineWidth = 8; ctx.stroke(); // cheap glow (shadowBlur is slow on phones)
      ctx.strokeStyle = '#0F9D6B'; ctx.lineWidth = 2; ctx.stroke();

      // live dot
      const lx = x(shown - 1), ly = y(pts[shown - 1]);
      const pulse = (Date.now() % 1600) / 1600;
      ctx.beginPath(); ctx.arc(lx, ly, 4 + pulse * 14, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(15,157,107,${0.35 * (1 - pulse)})`; ctx.fill();
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0F9D6B'; ctx.fill();
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (small && frame++ % 2) return;
      const k = small ? 2 : 1; // same speed at 30fps
      if (reveal < 1) reveal = Math.min(1, reveal + 0.008 * k);
      else {
        offset += 0.35 * k;
        if (offset >= STEP) { offset -= STEP; pts.shift(); pts.push(next(pts[pts.length - 1])); }
      }
      draw();
    };
    const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(tick); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    let onScreen = true;
    const sync = () => (onScreen && !document.hidden ? start() : stop());

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
    io.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    if (reduce) { reveal = 1; draw(); } else start();
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
