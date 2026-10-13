import { useEffect, useState } from 'react';
import { Box, Typography, Alert, Button } from '@mui/material';
import { supabase, fetchAll } from './supabase';
import { line } from '../theme';
import { money } from '../finance';
import { today, shift, fmtDate, monthName, sum, Signed, Panel, CapMeter, Figures, Pairs, ShowMore, PAGE_ROWS, rowLink, tableHead, tableRow, PageTitle, DayNav } from './ui';

const cols = { xs: '1fr auto', md: '1.3fr 0.8fr 1.9fr 0.8fr' };
const head = { ...tableHead, columnGap: 4 };
const bold = { fontWeight: 700 };

// The hidden charge Exit took on profitable days (entered amount minus what the partner sees). Staff only.
export const hiddenCharge = (entries, days) => entries.reduce((t, e) => {
  const d = days.find((x) => x.franchisee_id === e.franchisee_id && x.trade_date === e.trade_date);
  return t + (d && Number(e.amount) > 0 ? Number(e.amount) - Number(d.net) : 0);
}, 0);

export default function Dashboard({ profile, id }) {
  const staff = profile.role !== 'franchisee';
  // #/today/2026-10-12 opens that day (from Month at a glance); otherwise the latest day with results.
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(id ?? '') ? id : null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(PAGE_ROWS);

  // Open on the latest day that has results.
  useEffect(() => {
    if (date) return;
    supabase.from('franchisee_days').select('trade_date').order('trade_date', { ascending: false }).limit(1)
      .then(({ data, error }) => (error ? setError(error.message) : setDate(data[0]?.trade_date ?? today())));
  }, []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLimit(PAGE_ROWS);
    const from = `${date.slice(0, 7)}-01`;
    Promise.all([
      fetchAll((o) => supabase.from('franchisee_days').select('*, franchisees(name)', o).gte('trade_date', from).lte('trade_date', date).order('trade_date').order('franchisee_id')),
      fetchAll((o) => supabase.from('customer_days')
        .select('customer_id, franchisee_id, credited, cap, covered, capital, customers(full_name)', o)
        .eq('trade_date', date).order('customer_id')),
      staff ? fetchAll((o) => supabase.from('daily_entries').select('franchisee_id, trade_date, amount', o).gte('trade_date', from).lte('trade_date', date).order('trade_date').order('franchisee_id')) : { data: [] },
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
  const partnerName = Object.fromEntries(month.map((d) => [d.franchisee_id, d.franchisees.name]));
  const dayEntries = entries.filter((e) => e.trade_date === date);
  const exitDay = hiddenCharge(dayEntries, day) + sum(day, 'exit_share');

  const figures = staff
    ? [
      { label: sum(dayEntries, 'amount') < 0 ? 'Total loss today' : 'Total profit today', value: <Signed value={sum(dayEntries, 'amount')} sx={bold} /> },
      { label: 'Credited to customers', value: <Signed value={sum(day, 'to_customers')} sx={bold} /> },
      { label: 'Partners earned today', value: <Signed value={sum(day, 'partner_income')} signed={false} sx={bold} /> },
      { label: 'Exit earned today', value: money(exitDay) },
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
      <PageTitle action={<DayNav date={date} setDate={setDate} />}>
        {/* Phones: the picker already shows the date, so the title is just the weekday and fits on the same row. */}
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{fmtDate(date)}</Box>
        <Box component="span" sx={{ display: { sm: 'none' } }}>{fmtDate(date, { weekday: 'long' })}</Box>
      </PageTitle>

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
                        display: 'grid', columnGap: 4, rowGap: 0.5, ...tableRow, alignItems: 'baseline',
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
              {rows.slice(0, limit).map((r) => (
                <Box component="li" key={r.customer_id} sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                  <Box
                    component="a"
                    href={`#/customers/${r.customer_id}`}
                    sx={{
                      ...rowLink, columnGap: { xs: 2, md: 4 }, rowGap: 1.25, gridTemplateColumns: cols,
                      gridTemplateAreas: { xs: '"name day" "cap cap"', md: '"name day cap capital"' },
                      ...tableRow,
                    }}
                  >
                    <Box sx={{ gridArea: 'name', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{r.customers.full_name}</Typography>
                      {staff && <Typography variant="caption" color="text.secondary" noWrap component="p">{partnerName[r.franchisee_id]}</Typography>}
                    </Box>
                    <Box sx={{ gridArea: 'day', textAlign: 'right' }}><Signed value={r.credited} /></Box>
                    <Box sx={{ gridArea: 'cap' }}><CapMeter covered={r.covered} cap={r.cap} /></Box>
                    <Box sx={{ gridArea: 'capital', display: { xs: 'none', md: 'block' }, textAlign: 'right', color: 'text.secondary' }}>{money(r.capital)}</Box>
                  </Box>
                </Box>
              ))}
            </Box>
            <ShowMore shown={limit} total={rows.length} onMore={() => setLimit(limit + PAGE_ROWS)} />
          </Panel>
        </>
      )}
    </>
  );
}
