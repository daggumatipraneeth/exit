import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Alert, Button } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { supabase } from './supabase';
import { money } from '../finance';
import { ink, line } from '../theme';
import { today, shift, fmtDate, monthName, sum, Signed, Panel, CapMeter, Figures, rowLink } from './ui';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cols = { xs: '1fr auto', md: '1.3fr 0.9fr 1.8fr 0.9fr' };

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
        .select('customer_id, customer_today, franchisee_income, cap, covered, customers(full_name, franchisees(name))')
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
  const partners = new Set(day.map((d) => d.franchisee_id)).size;
  const earnedLabel = staff ? 'Partners earned' : 'You earned';

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: { xs: '1.6rem', md: '2.1rem' }, flex: '1 1 auto' }}>
          {fmtDate(date)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton aria-label="Previous day" onClick={() => setDate(shift(date, -1))}><ChevronLeft /></IconButton>
          <Box
            component="input"
            type="date"
            aria-label="Choose a day"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            sx={{ font: 'inherit', fontWeight: 600, color: ink, border: `1px solid ${line}`, borderRadius: 1.5, bgcolor: '#fff', px: 1.5, py: 0.75, minHeight: 40 }}
          />
          <IconButton aria-label="Next day" disabled={date >= today()} onClick={() => setDate(shift(date, 1))}><ChevronRight /></IconButton>
        </Box>
      </Box>

      {rows.length === 0 ? (
        <Panel sx={{ px: { xs: 2, md: 3 }, py: 5, textAlign: 'center' }}>
          <Typography variant="h6" component="p">No trades were recorded on {fmtDate(date)}.</Typography>
          <Button sx={{ mt: 2 }} onClick={() => setDate(shift(date, -1))}>See the day before</Button>
        </Panel>
      ) : (
        <>
          <Figures
            items={[
              {
                label: staff ? `${plural(rows.length, 'customer')} across ${plural(partners, 'partner')}` : `Your ${plural(rows.length, 'customer')} today`,
                value: <Signed value={sum(day, 'customer_total')} sx={{ fontWeight: 700 }} />,
              },
              { label: `${earnedLabel} today`, value: <Signed value={sum(day, 'franchisee_income')} signed={false} sx={{ fontWeight: 700 }} /> },
              {
                label: `${earnedLabel} in ${monthName(date)}`,
                value: <Signed value={sum(month, 'franchisee_income')} signed={false} sx={{ fontWeight: 700 }} />,
                note: <>Customers {sum(month, 'customer_total') < 0 ? 'lost' : 'made'} <Signed value={sum(month, 'customer_total')} abs />
                  {staff && <>, Exit commission {money(sum(month, 'exit_cut'))}</>}</>,
              },
            ]}
          />

          <Panel title={`Customers on ${fmtDate(date, { day: 'numeric', month: 'long' })}`} sx={{ mt: { xs: 3, md: 4 } }}>
            <Box
              aria-hidden
              sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: cols.md, columnGap: 4, px: 3, py: 1.25, color: 'text.secondary', fontSize: 13, borderBottom: `1px solid ${line}` }}
            >
              <span>Customer</span><Box sx={{ textAlign: 'right' }}>Their day</Box><span>Monthly cap</span>
              <Box sx={{ textAlign: 'right' }}>{earnedLabel}</Box>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {rows.map((r) => (
                <Box component="li" key={r.customer_id} sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                  <Box
                    component="a"
                    href={`#/customers/${r.customer_id}`}
                    sx={{
                      ...rowLink, columnGap: { xs: 2, md: 4 }, rowGap: 1.25, gridTemplateColumns: cols,
                      gridTemplateAreas: { xs: '"name day" "cap cap" "earned earned"', md: '"name day cap earned"' },
                      px: { xs: 2, md: 3 }, py: 2,
                    }}
                  >
                    <Box sx={{ gridArea: 'name', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{r.customers.full_name}</Typography>
                      {staff && <Typography variant="caption" color="text.secondary" noWrap component="p">{r.customers.franchisees.name}</Typography>}
                    </Box>
                    <Box sx={{ gridArea: 'day', textAlign: 'right' }}><Signed value={r.customer_today} /></Box>
                    <Box sx={{ gridArea: 'cap' }}><CapMeter covered={r.covered} cap={r.cap} /></Box>
                    <Box sx={{ gridArea: 'earned', display: 'flex', justifyContent: { xs: 'space-between', md: 'flex-end' }, fontSize: { xs: 14, md: 16 } }}>
                      <Box component="span" sx={{ display: { md: 'none' }, color: 'text.secondary' }}>{earnedLabel}</Box>
                      <Signed value={r.franchisee_income} signed={false} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Panel>
        </>
      )}
    </>
  );
}
