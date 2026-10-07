import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Alert, Button } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { supabase } from './supabase';
import { money } from '../finance';
import { ink, line } from '../theme';
import { today, shift, fmtDate, monthName, sum, Signed, Panel, CapMeter, Figures, Pairs, rowLink } from './ui';

const cols = { xs: '1fr auto', md: '1.3fr 0.8fr 1.9fr 0.8fr' };
const head = { display: { xs: 'none', md: 'grid' }, columnGap: 4, px: 3, py: 1.25, color: 'text.secondary', fontSize: 13, borderBottom: `1px solid ${line}` };
const bold = { fontWeight: 700 };

// The hidden charge Exit took on profitable days (entered amount minus what the partner sees). Staff only.
const hiddenCharge = (entries, days) => entries.reduce((t, e) => {
  const d = days.find((x) => x.franchisee_id === e.franchisee_id && x.trade_date === e.trade_date);
  return t + (d && Number(e.amount) > 0 ? Number(e.amount) - Number(d.net) : 0);
}, 0);

export default function Dashboard({ profile }) {
  const staff = profile.role !== 'franchisee';
  const [date, setDate] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Open on the latest day that has results.
  useEffect(() => {
    supabase.from('franchisee_days').select('trade_date').order('trade_date', { ascending: false }).limit(1)
      .then(({ data, error }) => (error ? setError(error.message) : setDate(data[0]?.trade_date ?? today())));
  }, []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    const from = `${date.slice(0, 7)}-01`;
    Promise.all([
      supabase.from('franchisee_days').select('*, franchisees(name)').gte('trade_date', from).lte('trade_date', date),
      supabase.from('customer_days')
        .select('customer_id, credited, cap, covered, capital, customers(full_name, franchisees(name))')
        .eq('trade_date', date),
      staff ? supabase.from('daily_entries').select('franchisee_id, trade_date, amount').gte('trade_date', from).lte('trade_date', date) : { data: [] },
    ]).then(([days, rows, entries]) => {
      if (!live) return;
      const err = days.error ?? rows.error ?? entries.error;
      if (err) return setError(err.message);
      setError('');
      setData({
        day: days.data.filter((r) => r.trade_date === date),
        month: days.data,
        rows: rows.data.sort((a, b) => a.customers.full_name.localeCompare(b.customers.full_name)),
        entries: entries.data,
      });
    });
    return () => { live = false; };
  }, [date]);

  if (error) return <Alert severity="error">Couldn't load results: {error}</Alert>;
  if (!date || !data) return null;

  const { day, month, rows, entries } = data;
  const dayEntries = entries.filter((e) => e.trade_date === date);
  const exitDay = hiddenCharge(dayEntries, day) + sum(day, 'exit_share');
  const exitMonth = hiddenCharge(entries, month) + sum(month, 'exit_share');

  const figures = staff
    ? [
      { label: `Entered for ${day.length} ${day.length === 1 ? 'partner' : 'partners'}`, value: <Signed value={sum(dayEntries, 'amount')} sx={bold} />, note: <>After hidden charge {money(sum(day, 'net'))}</> },
      { label: 'Credited to customers', value: <Signed value={sum(day, 'to_customers')} sx={bold} /> },
      { label: 'Partners earned today', value: <Signed value={sum(day, 'partner_income')} signed={false} sx={bold} /> },
      { label: 'Exit earned today', value: money(exitDay), note: <>{monthName(date)}: {money(exitMonth)}</> },
    ]
    : [
      { label: "Today's result", value: <Signed value={sum(day, 'net')} sx={bold} /> },
      { label: 'Credited to your customers', value: <Signed value={sum(day, 'to_customers')} sx={bold} /> },
      {
        label: 'You earned today', value: <Signed value={sum(day, 'partner_income')} signed={false} sx={bold} />,
        note: sum(day, 'overflow') > 0 ? <>Exit's share {money(sum(day, 'exit_share'))}</> : 'Starts when every bucket is full',
      },
      { label: `You earned in ${monthName(date)}`, value: <Signed value={sum(month, 'partner_income')} signed={false} sx={bold} />, note: <>Exit's share {money(sum(month, 'exit_share'))}</> },
    ];

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

      {day.length === 0 ? (
        <Panel sx={{ px: { xs: 2, md: 3 }, py: 5, textAlign: 'center' }}>
          <Typography variant="h6" component="p">No results were entered for {fmtDate(date)}.</Typography>
          <Button sx={{ mt: 2 }} onClick={() => setDate(shift(date, -1))}>See the day before</Button>
        </Panel>
      ) : (
        <>
          <Figures items={figures} />

          {staff && (
            <Panel title="Partners" sx={{ mt: { xs: 3, md: 4 } }}>
              <Box aria-hidden sx={{ ...head, gridTemplateColumns: '1.4fr repeat(4, 1fr)', '& > :not(:first-of-type)': { textAlign: 'right' } }}>
                <span>Partner</span><span>Entered</span><span>To customers</span><span>Partner earned</span><span>Exit share</span>
              </Box>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {day.map((d) => {
                  const e = dayEntries.find((x) => x.franchisee_id === d.franchisee_id);
                  return (
                    <Box
                      component="li"
                      key={d.franchisee_id}
                      sx={{
                        display: 'grid', columnGap: 4, rowGap: 0.5, px: { xs: 2, md: 3 }, py: 1.75, alignItems: 'baseline',
                        gridTemplateColumns: { xs: '1fr auto', md: '1.4fr repeat(4, 1fr)' },
                        '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                      }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>{d.franchisees.name}</Typography>
                      <Box sx={{ textAlign: 'right' }}><Signed value={e?.amount ?? 0} /></Box>
                      <Pairs
                        sx={{ display: { xs: 'grid', md: 'none' }, gridColumn: '1 / -1', mt: 0.75 }}
                        items={[['To customers', money(d.to_customers)], ['Partner earned', money(d.partner_income)], ['Exit share', money(d.exit_share)]]}
                      />
                      {['to_customers', 'partner_income', 'exit_share'].map((k) => (
                        <Box key={k} sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{money(d[k])}</Box>
                      ))}
                    </Box>
                  );
                })}
              </Box>
            </Panel>
          )}

          <Panel title={`Customers on ${fmtDate(date, { day: 'numeric', month: 'long' })}`} sx={{ mt: { xs: 3, md: 4 } }}>
            <Box aria-hidden sx={{ ...head, gridTemplateColumns: cols.md }}>
              <span>Customer</span><Box sx={{ textAlign: 'right' }}>Credited</Box><span>Monthly bucket</span><Box sx={{ textAlign: 'right' }}>Capital</Box>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {rows.map((r) => (
                <Box component="li" key={r.customer_id} sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                  <Box
                    component="a"
                    href={`#/customers/${r.customer_id}`}
                    sx={{
                      ...rowLink, columnGap: { xs: 2, md: 4 }, rowGap: 1.25, gridTemplateColumns: cols,
                      gridTemplateAreas: { xs: '"name day" "cap cap"', md: '"name day cap capital"' },
                      px: { xs: 2, md: 3 }, py: 2,
                    }}
                  >
                    <Box sx={{ gridArea: 'name', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{r.customers.full_name}</Typography>
                      {staff && <Typography variant="caption" color="text.secondary" noWrap component="p">{r.customers.franchisees.name}</Typography>}
                    </Box>
                    <Box sx={{ gridArea: 'day', textAlign: 'right' }}><Signed value={r.credited} /></Box>
                    <Box sx={{ gridArea: 'cap' }}><CapMeter covered={r.covered} cap={r.cap} /></Box>
                    <Box sx={{ gridArea: 'capital', display: { xs: 'none', md: 'block' }, textAlign: 'right', color: 'text.secondary' }}>{money(r.capital)}</Box>
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
