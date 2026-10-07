import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Alert, Button } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { supabase } from './supabase';
import { money } from '../finance';
import { accent, ink, line, loss, navy } from '../theme';

// Dates travel as 'YYYY-MM-DD' strings in local time.
const iso = (d) => d.toLocaleDateString('en-CA');
const today = () => iso(new Date());
const shift = (date, days) => { const d = new Date(`${date}T00:00`); d.setDate(d.getDate() + days); return iso(d); };
const longDate = (date) => new Date(`${date}T00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const monthName = (date) => new Date(`${date}T00:00`).toLocaleDateString('en-IN', { month: 'long' });
const sum = (rows, key) => rows.reduce((t, r) => t + Number(r[key]), 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Amount({ value, signed = true }) {
  const v = Number(value);
  return (
    <Box component="strong" sx={{ fontWeight: 700, color: v < 0 ? loss : v > 0 && signed ? accent : 'inherit', whiteSpace: 'nowrap' }}>
      {money(Math.abs(v))}
    </Box>
  );
}

const madeOrLost = (v) => (Number(v) < 0 ? 'lost' : 'made');

function CapMeter({ covered, cap }) {
  const c = Number(covered);
  const full = c >= Number(cap);
  const fill = cap > 0 ? Math.max(0, Math.min(1, c / cap)) : 0;
  return (
    <Box>
      <Box
        role="meter"
        aria-label="Customer's progress to monthly cap"
        aria-valuemin={0}
        aria-valuemax={Number(cap)}
        aria-valuenow={c}
        sx={{ height: 6, borderRadius: 3, bgcolor: '#E6EBF2', overflow: 'hidden' }}
      >
        <Box sx={{ height: 1, width: `${fill * 100}%`, bgcolor: full ? accent : navy, borderRadius: 3 }} />
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: c < 0 ? loss : 'text.secondary' }}>
        {full ? `Cap of ${money(cap)} reached` : c < 0 ? `${money(c)} this month, cap ${money(cap)}` : `${money(c)} of ${money(cap)} cap`}
      </Typography>
    </Box>
  );
}

export default function Dashboard({ profile }) {
  const staff = profile.role !== 'franchisee';
  const [date, setDate] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Open on the latest day that has results.
  useEffect(() => {
    supabase.from('daily_results').select('trade_date').order('trade_date', { ascending: false }).limit(1)
      .then(({ data, error }) => (error ? setError(error.message) : setDate(data[0]?.trade_date ?? today())));
  }, []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    Promise.all([
      supabase.from('franchisee_daily').select('*').gte('trade_date', `${date.slice(0, 7)}-01`).lte('trade_date', date),
      supabase.from('daily_results')
        .select('customer_id, customer_today, franchisee_income, exit_cut, cap, covered, customers(full_name, franchisees(name))')
        .eq('trade_date', date),
    ]).then(([days, rows]) => {
      if (!live) return;
      const err = days.error ?? rows.error;
      if (err) return setError(err.message);
      setError('');
      setData({
        day: days.data.filter((r) => r.trade_date === date),
        month: days.data,
        rows: rows.data.sort((a, b) => a.customers.full_name.localeCompare(b.customers.full_name)),
      });
    });
    return () => { live = false; };
  }, [date]);

  if (error) return <Alert severity="error">Couldn't load results: {error}</Alert>;
  if (!date || !data) return null;

  const { day, month, rows } = data;
  const customers = sum(day, 'customer_total');
  const earned = sum(day, 'franchisee_income');
  const monthCustomers = sum(month, 'customer_total');
  const monthEarned = sum(month, 'franchisee_income');
  const count = rows.length;
  const partners = new Set(day.map((d) => d.franchisee_id)).size;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: { xs: 3, md: 4 }, ml: -1 }}>
        <IconButton aria-label="Previous day" onClick={() => setDate(shift(date, -1))}><ChevronLeft /></IconButton>
        <Box
          component="input"
          type="date"
          aria-label="Choose a day"
          value={date}
          max={today()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          sx={{ font: 'inherit', fontWeight: 600, color: ink, border: `1px solid ${line}`, borderRadius: 1.5, bgcolor: '#fff', px: 1.5, py: 0.75 }}
        />
        <IconButton aria-label="Next day" disabled={date >= today()} onClick={() => setDate(shift(date, 1))}><ChevronRight /></IconButton>
      </Box>

      {count === 0 ? (
        <Box sx={{ py: 6 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 500, maxWidth: '24ch' }}>
            No trades were recorded on {longDate(date)}.
          </Typography>
          <Button sx={{ mt: 3, ml: -1.5 }} onClick={() => setDate(shift(date, -1))}>See the day before</Button>
        </Box>
      ) : (
        <>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.25, maxWidth: '30ch', fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' } }}
          >
            On {longDate(date)}{' '}
            {staff ? <>{plural(count, 'customer')} across {plural(partners, 'partner')}</> : <>your {plural(count, 'customer')}</>}{' '}
            {madeOrLost(customers)} <Amount value={customers} /> and {staff ? 'partners' : 'you'} earned <Amount value={earned} />.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, fontSize: { xs: '1rem', md: '1.125rem' }, maxWidth: '60ch' }}>
            So far in {monthName(date)} {staff ? 'customers have' : 'your customers have'} {madeOrLost(monthCustomers)}{' '}
            <Amount value={monthCustomers} /> and {staff ? 'partners have' : 'you have'} earned <Amount value={monthEarned} />.
            {staff && <> Exit's commission this month is <Amount value={sum(month, 'exit_cut')} signed={false} />.</>}
          </Typography>

          <Box component="section" aria-labelledby="customers-heading" sx={{ mt: { xs: 5, md: 7 }, bgcolor: '#fff', border: `1px solid ${line}`, borderRadius: 2 }}>
            <Typography id="customers-heading" variant="h6" component="h2" sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: `1px solid ${line}` }}>
              Customers on {longDate(date)}
            </Typography>
            <Box
              aria-hidden
              sx={{
                display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '1.3fr 0.9fr 1.8fr 0.9fr', columnGap: 4,
                px: 3, py: 1.25, color: 'text.secondary', fontSize: 13, borderBottom: `1px solid ${line}`,
              }}
            >
              <span>Customer</span><Box sx={{ textAlign: 'right' }}>Their day</Box><span>Monthly cap</span>
              <Box sx={{ textAlign: 'right' }}>{staff ? 'Partner earned' : 'You earned'}</Box>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {rows.map((r) => (
                <Box
                  component="li"
                  key={r.customer_id}
                  sx={{
                    display: 'grid', alignItems: 'center', columnGap: { xs: 2, md: 4 }, rowGap: 1.25,
                    gridTemplateColumns: { xs: '1fr auto', md: '1.3fr 0.9fr 1.8fr 0.9fr' },
                    gridTemplateAreas: { xs: '"name day" "cap cap" "earned earned"', md: '"name day cap earned"' },
                    px: { xs: 2, md: 3 }, py: 2, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                  }}
                >
                  <Box sx={{ gridArea: 'name', minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>{r.customers.full_name}</Typography>
                    {staff && <Typography variant="caption" color="text.secondary" noWrap component="p">{r.customers.franchisees.name}</Typography>}
                  </Box>
                  <Box sx={{ gridArea: 'day', textAlign: 'right', fontWeight: 600, color: r.customer_today < 0 ? loss : r.customer_today > 0 ? accent : 'text.secondary' }}>
                    {money(r.customer_today, true)}
                  </Box>
                  <Box sx={{ gridArea: 'cap' }}><CapMeter covered={r.covered} cap={r.cap} /></Box>
                  <Box sx={{ gridArea: 'earned', textAlign: { md: 'right' }, fontSize: { xs: 14, md: 16 }, color: r.franchisee_income > 0 ? ink : 'text.secondary', fontWeight: r.franchisee_income > 0 ? 600 : 400 }}>
                    <Box component="span" sx={{ display: { md: 'none' }, color: 'text.secondary', fontWeight: 400 }}>
                      {staff ? 'Partner earned ' : 'You earned '}
                    </Box>
                    {money(r.franchisee_income)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </>
      )}
    </>
  );
}
