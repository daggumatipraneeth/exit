// Small pieces shared by portal pages.
import { Box, Typography, Chip, Button, Link } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { money } from '../finance';
import { accent, line, loss, navy } from '../theme';

// Dates travel as 'YYYY-MM-DD' strings in local time.
export const iso = (d) => d.toLocaleDateString('en-CA');
export const today = () => iso(new Date());
export const shift = (date, days) => { const d = new Date(`${date}T00:00`); d.setDate(d.getDate() + days); return iso(d); };
export const fmtDate = (date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${date}T00:00`).toLocaleDateString('en-IN', opts);
export const shortDate = (date) => fmtDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
export const monthName = (date) => fmtDate(date, { month: 'long', year: 'numeric' });
export const sum = (rows, key) => rows.reduce((t, r) => t + Number(r[key]), 0);

export const tone = (v) => (Number(v) < 0 ? loss : Number(v) > 0 ? accent : 'text.secondary');

// Coloured, signed rupee amount that never wraps. abs: show without sign (for "made"/"lost" copy), keep the colour.
export function Signed({ value, signed = true, abs, sx }) {
  return (
    <Box component="span" sx={{ color: tone(value), fontWeight: 600, whiteSpace: 'nowrap', ...sx }}>
      {abs ? money(Math.abs(value)) : money(value, signed)}
    </Box>
  );
}

export function Panel({ title, action, children, sx }) {
  return (
    <Box component="section" sx={{ bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2, ...sx }}>
      {title && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, px: { xs: 2, md: 3 }, py: 1.75, borderBottom: `1px solid ${line}`,
            '& > .MuiButton-text': { px: 1.5, mr: -1.5 }, // text sits on the panel's right edge, like the content below
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', flex: 1, minWidth: 'fit-content' }}>{title}</Typography>
          {action}
        </Box>
      )}
      {children}
    </Box>
  );
}

// One label/value pair in a details list.
export function Field({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{children || '–'}</Typography>
    </Box>
  );
}

const statusLook = {
  draft: ['Draft', 'default'],
  awaiting_signature: ['Awaiting signature', 'warning'],
  pending_approval: ['Pending approval', 'info'],
  active: ['Active', 'success'],
  rejected: ['Rejected', 'error'],
};
export function StatusChip({ status }) {
  const [label, color] = statusLook[status];
  return <Chip size="small" label={label} color={color} variant={status === 'active' ? 'filled' : 'outlined'} />;
}

export function CapMeter({ covered, cap, thick }) {
  const c = Number(covered);
  const full = c >= Number(cap);
  const fill = cap > 0 ? Math.max(0, Math.min(1, c / cap)) : 0;
  return (
    <Box>
      <Box
        role="meter"
        aria-label="Progress to monthly cap"
        aria-valuemin={0}
        aria-valuemax={Number(cap)}
        aria-valuenow={c}
        sx={{ height: thick ? 10 : 6, borderRadius: 5, bgcolor: '#E6EBF2', overflow: 'hidden' }}
      >
        <Box sx={{ height: 1, width: `${fill * 100}%`, bgcolor: full ? accent : navy, borderRadius: 5 }} />
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: c < 0 ? loss : 'text.secondary' }}>
        {full ? `Cap of ${money(cap)} reached` : c < 0 ? `${money(c)} this month, cap ${money(cap)}` : `${money(c)} of ${money(cap)} cap`}
      </Typography>
    </Box>
  );
}

// Row of figures inside one panel, divided by rules; stacks on phones.
export function Figures({ items }) {
  return (
    <Box
      sx={{
        display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${items.length}, minmax(0, 1fr))` },
        bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2,
        '& > *:not(:last-child)': { borderBottom: { xs: `1px solid ${line}`, sm: 'none' }, borderRight: { sm: `1px solid ${line}` } },
      }}
    >
      {items.map(({ label, value, note }) => (
        <Box
          key={label}
          sx={{
            px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 2.5 }, minWidth: 0,
            display: { xs: 'grid', sm: 'block' }, gridTemplateColumns: '1fr auto', alignItems: 'baseline', columnGap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography component="div" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem', md: '1.75rem' }, fontWeight: 700, letterSpacing: '-0.02em', mt: { sm: 0.25 }, textAlign: { xs: 'right', sm: 'left' } }}>
            {value}
          </Typography>
          {note && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, gridColumn: '1 / -1' }}>{note}</Typography>}
        </Box>
      ))}
    </Box>
  );
}

export const rowLink = {
  display: 'grid', alignItems: 'center', color: 'inherit', textDecoration: 'none',
  '&:hover': { bgcolor: '#F8FAFC' },
  '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: -2 },
};

export function PageTitle({ children, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: { xs: '1.6rem', md: '2.1rem' }, flex: '1 1 auto' }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}

// Supabase errors carry the Postgres message; show just that.
export const errText = (e) => e?.message ?? String(e);

// Centered column for form pages, so they don't hang off the left on wide screens.
// "← All customers" style link above a page title.
export function BackLink({ href, children }) {
  return (
    <Link href={href} underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minHeight: 40, mb: 1, fontWeight: 500 }}>
      <ArrowBackIcon fontSize="small" /> {children}
    </Link>
  );
}

export function FormPage({ children, width = 880 }) {
  return <Box sx={{ maxWidth: width, mx: 'auto' }}>{children}</Box>;
}

// Pill filters: selected is filled navy, others outlined on the page background.
// Phones: one row that scrolls sideways instead of wrapping.
export function FilterChips({ label, value, onChange, options }) {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'flex', gap: 1, flexWrap: { xs: 'nowrap', sm: 'wrap' }, overflowX: { xs: 'auto', sm: 'visible' },
        mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <Chip
            key={v}
            label={text}
            clickable
            aria-pressed={on}
            onClick={() => onChange(v)}
            color={on ? 'primary' : 'default'}
            variant={on ? 'filled' : 'outlined'}
            sx={{
              height: 40, borderRadius: 999, px: 0.75, flexShrink: 0, fontSize: 14, fontWeight: on ? 600 : 500,
              ...(!on && { borderColor: line, color: 'text.primary', bgcolor: 'transparent', '&:hover': { bgcolor: 'rgba(18,40,74,.06)' } }),
            }}
          />
        );
      })}
    </Box>
  );
}

// Labelled amounts: one row each on phones (label left, value right, never colliding),
// side-by-side columns from the md breakpoint.
export function Pairs({ items, sx }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${items.length}, minmax(0, 1fr))` }, columnGap: 3, rowGap: { xs: 0.75, md: 0 }, minWidth: 0, ...sx }}>
      {items.map(([label, value]) => (
        <Box key={label} sx={{ display: { xs: 'flex', md: 'block' }, justifyContent: 'space-between', alignItems: 'baseline', gap: 2, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{value}</Box>
        </Box>
      ))}
    </Box>
  );
}

// Long lists render 100 rows at a time so phones stay responsive with thousands of customers.
export const PAGE_ROWS = 100;
export function ShowMore({ shown, total, onMore }) {
  if (shown >= total) return null;
  const next = Math.min(PAGE_ROWS, total - shown);
  return (
    <Box sx={{ p: 1.5, textAlign: 'center', borderTop: `1px solid ${line}` }}>
      <Button onClick={onMore}>Show {next} more ({total - shown} not shown)</Button>
    </Box>
  );
}
