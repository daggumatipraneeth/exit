// Month calendar of daily profit/loss, shaded by size. Used on Month (staff, partners) and on the customer's own page.
import { Box, Typography, Tooltip } from '@mui/material';
import { money } from '../finance';
import { accent, ink, line, loss } from '../theme';
import { today, fmtDate } from './ui';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (d) => d.toLocaleDateString('en-CA');

// Short amounts for calendar cells. Desktop: +₹12.4k / −₹1.2L. Phone (narrow cells): 12k / −3.7k, no ₹ or +.
const short = (n, unit) => `${(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)}${unit}`;
function compact(v, phone) {
  const a = Math.abs(v);
  const s = a >= 1e7 ? short(a / 1e7, 'Cr') : a >= 1e5 ? short(a / 1e5, 'L') : a >= 1e3 ? short(a / 1e3, 'k') : Math.round(a);
  return phone ? `${v < 0 ? '−' : ''}${s}` : `${v < 0 ? '−' : '+'}₹${s}`;
}

// Diverging scale: profit green, loss red, four steps by size against the month's biggest day. Text stays in ink.
const shade = (v, max) => {
  if (!v || !max) return '#fff';
  const step = Math.min(4, Math.ceil((Math.abs(v) / max) * 4));
  return `color-mix(in srgb, ${v > 0 ? accent : loss} ${[0, 14, 26, 38, 50][step]}%, #fff)`;
};

// `link`: days open the staff day page (off for customers).
export default function Heatmap({ month, byDay, link = true }) {
  const first = new Date(`${month}T00:00`);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const days = [];
  for (let d = new Date(first); d.getMonth() === first.getMonth(); d.setDate(d.getDate() + 1)) days.push(iso(d));
  const max = Math.max(0, ...Object.values(byDay).map(Math.abs));
  const now = today();

  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, py: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, md: 1 } }}>
        {weekdays.map((w) => (
          <Typography key={w} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 500 }}>{w}</Typography>
        ))}
        {Array.from({ length: lead }, (_, i) => <Box key={`b${i}`} />)}
        {days.map((d) => {
          const v = byDay[d];
          const has = v !== undefined;
          const go = has && link;
          const cell = (
            <Box
              component={go ? 'a' : 'div'}
              href={go ? `#/today/${d}` : undefined}
              aria-label={has ? `${fmtDate(d)}: ${money(v, true)}` : undefined}
              sx={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: { xs: 48, md: 72 },
                p: { xs: 0.5, md: 1 }, borderRadius: 1.5, border: `1px solid ${line}`, bgcolor: shade(v, max),
                color: ink, textDecoration: 'none', opacity: d > now ? 0.45 : 1, minWidth: 0,
                ...(go && { '&:hover': { borderColor: ink } }),
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>{Number(d.slice(8))}</Typography>
              {has && (
                <Typography sx={{ fontSize: { xs: 11, md: 13 }, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{compact(v, true)}</Box>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{compact(v)}</Box>
                </Typography>
              )}
            </Box>
          );
          return has ? <Tooltip key={d} title={`${fmtDate(d)} · ${money(v, true)}`} disableInteractive>{cell}</Tooltip> : <Box key={d}>{cell}</Box>;
        })}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 3, rowGap: 1, mt: 2, color: 'text.secondary', fontSize: 12.5, '& > *': { display: 'flex', alignItems: 'center', gap: 0.75 } }}>
        <Box>
          <span>Loss</span>
          {[-4, -3, -2, -1, 1, 2, 3, 4].map((s) => <Box key={s} sx={{ width: 18, height: 12, borderRadius: 0.5, border: `1px solid ${line}`, bgcolor: shade(s, 4) }} />)}
          <span>Profit</span>
        </Box>
        <Box>
          <Box sx={{ width: 18, height: 12, borderRadius: 0.5, border: `1px solid ${line}`, bgcolor: '#fff' }} />
          <span>No trading</span>
        </Box>
        {link && <Box sx={{ ml: { md: 'auto' } }}>Tap a day to see its details.</Box>}
      </Box>
    </Box>
  );
}
