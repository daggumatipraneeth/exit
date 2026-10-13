// Month at a glance (staff and partners): a profit/loss calendar heatmap, the month's totals, and per-partner and
// per-customer breakdowns. Row-level security decides what each person gets back; partners see only their own.
import { useEffect, useState } from 'react';
import { Box, Typography, Alert, Tooltip, IconButton } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { supabase, fetchAll } from './supabase';
import { capitalOn } from './Capital';
import { money } from '../finance';
import { accent, ink, line, loss } from '../theme';
import {
  today, pickerField, pickerBox, fmtDate, monthName, sum, tone, Signed, Panel, PageTitle, Figures, Pairs, Pill, CapMeter, ShowMore, PAGE_ROWS,
  rowLink, tableHead, tableRow,
} from './ui';
import { hiddenCharge } from './Dashboard';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (d) => d.toLocaleDateString('en-CA');

// Amount invested for the month, the same rule as the server's capital_for_month: capital on the 1st, or for
// someone who started during the month, their capital on their first day.
function investedIn(moves, month, end) {
  const first = moves.map((m) => m.effective_from).filter((d) => d > month && d < end).sort()[0];
  return capitalOn(moves, month) || (first ? capitalOn(moves, first) : 0);
}

// Return as a % of the amount invested, coloured like the amount it comes from.
const pct = (v, base) => (base > 0 ? (v / base) * 100 : null);
function Pct({ value, sx }) {
  if (value == null) return '–';
  return <Box component="span" sx={{ color: tone(value), fontWeight: 600, whiteSpace: 'nowrap', ...sx }}>{value > 0 ? '+' : ''}{value.toFixed(2)}%</Box>;
}
const monthEnd = (m) => { const d = new Date(`${m}T00:00`); d.setMonth(d.getMonth() + 1); return iso(d); };

// Short amounts for calendar cells. Desktop: +₹12.4k / −₹1.2L. Phone (narrow cells): 12k / −3.7k, no ₹ or +.
const short = (n, unit) => `${(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)}${unit}`;
function compact(v, phone) {
  const a = Math.abs(v);
  const s = a >= 1e7 ? short(a / 1e7, 'Cr') : a >= 1e5 ? short(a / 1e5, 'L') : a >= 1e3 ? short(a / 1e3, 'k') : Math.round(a);
  return phone ? `${v < 0 ? '−' : ''}${s}` : `${v < 0 ? '−' : '+'}₹${s}`;
}
const shiftMonth = (m, n) => { const d = new Date(`${m}T00:00`); d.setMonth(d.getMonth() + n); return iso(d); };

// ‹ month › beside the title, like the day picker on Today: phones show "Oct 2026" with the native month input
// laid invisibly over it, so a tap still opens the phone's picker.
function MonthNav({ month, setMonth }) {
  const field = pickerField;
  const last = `${today().slice(0, 7)}-01`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, mr: { xs: -1, sm: 0 } }}>
      <IconButton aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></IconButton>
      <Box sx={pickerBox}>
        <Box aria-hidden sx={{ ...field, display: { xs: 'flex', sm: 'none' }, alignItems: 'center', whiteSpace: 'nowrap' }}>
          {fmtDate(month, { month: 'short', year: 'numeric' })}
        </Box>
        <Box
          component="input" type="month" aria-label="Choose a month" value={month.slice(0, 7)} max={last.slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
          sx={{ ...field, position: { xs: 'absolute', sm: 'static' }, inset: 0, width: { xs: 1, sm: 'auto' }, opacity: { xs: 0, sm: 1 } }}
        />
      </Box>
      <IconButton aria-label="Next month" disabled={month >= last} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></IconButton>
    </Box>
  );
}

// Diverging scale: profit green, loss red, four steps by size against the month's biggest day. Text stays in ink.
const shade = (v, max) => {
  if (!v || !max) return '#fff';
  const step = Math.min(4, Math.ceil((Math.abs(v) / max) * 4));
  return `color-mix(in srgb, ${v > 0 ? accent : loss} ${[0, 14, 26, 38, 50][step]}%, #fff)`;
};

// `link`: days open the staff day page (off for customers).
export function Heatmap({ month, byDay, link = true }) {
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

export default function MonthView({ profile }) {
  const staff = profile.role !== 'franchisee';
  const [month, setMonth] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(PAGE_ROWS);

  // Open on the latest month that has results.
  useEffect(() => {
    supabase.from('franchisee_days').select('trade_date').order('trade_date', { ascending: false }).limit(1)
      .then(({ data, error }) => (error ? setError(error.message) : setMonth(`${(data[0]?.trade_date ?? today()).slice(0, 7)}-01`)));
  }, []);

  useEffect(() => {
    if (!month) return;
    let live = true;
    setData(null);
    setLimit(PAGE_ROWS);
    const end = monthEnd(month);
    Promise.all([
      fetchAll((o) => supabase.from('franchisee_days').select('*, franchisees(name)', o).gte('trade_date', month).lt('trade_date', end).order('trade_date').order('franchisee_id')),
      staff ? fetchAll((o) => supabase.from('daily_entries').select('franchisee_id, trade_date, amount', o).gte('trade_date', month).lt('trade_date', end).order('trade_date').order('franchisee_id')) : { data: [] },
      fetchAll((o) => supabase.from('customer_month_progress').select('customer_id, cap, covered, credited', o).eq('month', month).order('customer_id')),
      fetchAll((o) => supabase.from('customers').select('id, full_name, franchisee_id, franchisees(name), capital_movements(effective_from, amount)', o).order('id')),
      fetchAll((o) => supabase.from('settlements').select('payout_total, paid_at', o).eq('month', month).order('customer_id')),
      supabase.from('closed_months').select('month').eq('month', month),
    ]).then(([days, entries, progress, customers, settled, closed]) => {
      if (!live) return;
      const err = days.error ?? entries.error ?? progress.error ?? customers.error ?? settled.error ?? closed.error;
      if (err) return setError(err.message);
      const who = Object.fromEntries(customers.data.map((c) => [c.id, c]));
      setData({
        days: days.data, entries: entries.data, settled: settled.data, closed: closed.data.length > 0,
        customers: progress.data.map((p) => {
          const c = who[p.customer_id] ?? {};
          return { ...p, ...c, invested: investedIn(c.capital_movements ?? [], month, end) };
        }).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')),
      });
    });
    return () => { live = false; };
  }, [month]);

  if (error) return <Alert severity="error">Couldn't load the month: {error}</Alert>;
  const title = (
    <PageTitle action={month && <MonthNav month={month} setMonth={setMonth} />}>
      {/* Phones: the picker shows the month, so the title stays short enough to share the row. */}
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{month ? monthName(month) : 'Month'}</Box>
      <Box component="span" sx={{ display: { sm: 'none' } }}>Month</Box>
    </PageTitle>
  );
  if (!month || !data) return title;

  const { days, entries, customers, settled, closed } = data;
  // What each day "made": staff see the entered figure, partners their result after Exit's charge.
  const byDay = {};
  for (const r of staff ? entries : days) byDay[r.trade_date] = (byDay[r.trade_date] ?? 0) + Number(staff ? r.amount : r.net);
  const dayList = Object.entries(byDay);
  const total = sum(dayList.map(([, v]) => ({ v })), 'v');
  const best = dayList.reduce((b, d) => (!b || d[1] > b[1] ? d : b), null);
  const worst = dayList.reduce((w, d) => (!w || d[1] < w[1] ? d : w), null);
  const full = customers.filter((c) => Number(c.cap) > 0 && Number(c.covered) >= Number(c.cap) - 0.01).length;
  const paidOut = sum(settled, 'payout_total');
  const invested = sum(customers, 'invested');
  const toCustomers = sum(days, 'to_customers');
  const unpaid = settled.some((s) => Number(s.payout_total) > 0 && !s.paid_at);

  // Per partner (staff only; a partner has just themselves).
  const partners = Object.values(days.reduce((acc, d) => {
    const p = (acc[d.franchisee_id] ??= { id: d.franchisee_id, name: d.franchisees.name, net: 0, to_customers: 0, partner_income: 0, exit_share: 0 });
    for (const k of ['net', 'to_customers', 'partner_income', 'exit_share']) p[k] += Number(d[k]);
    return acc;
  }, {})).map((p) => ({
    ...p,
    entered: sum(entries.filter((e) => e.franchisee_id === p.id), 'amount'),
    invested: sum(customers.filter((c) => c.franchisee_id === p.id), 'invested'),
  }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const bold = { fontWeight: 700 };
  const ofInvested = (v, what) => (invested > 0 ? <><Pct value={pct(v, invested)} /> {what}</> : null);
  const figures = [
    {
      label: 'Invested', value: money(invested), note: `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`,
      info: "Each customer's capital on the 1st of the month (or their first deposit, if they joined during the month). A month's buckets are worked out on this.",
    },
    {
      label: total < 0 ? 'Total loss' : 'Total profit', value: <Signed value={total} sx={bold} />, note: ofInvested(total, 'of invested'),
      info: staff ? 'Everything entered this month, before trade charges.' : "This month's results on your customers' money, after charges.",
    },
    {
      label: staff ? 'Credited to customers' : 'Credited to your customers',
      value: <Signed value={toCustomers} sx={bold} />, note: ofInvested(toCustomers, 'return for customers'),
      info: "Profit goes to customers first, in proportion to their capital, until each one's monthly bucket is full. Losses are taken the same way.",
    },
    ...(staff ? [
      {
        label: 'Partners earned', value: <Signed value={sum(days, 'partner_income')} signed={false} sx={bold} />,
        info: "Partners' share of profit once all of their customers' buckets are full.",
      },
      {
        label: 'Exit earned', value: money(hiddenCharge(entries, days) + sum(days, 'exit_share')),
        info: 'Trade charges on profitable days, plus Exit’s share of profit above full buckets.',
      },
    ] : [
      {
        label: `Your earnings for ${fmtDate(month, { month: 'short', year: 'numeric' })}`, value: <Signed value={sum(days, 'partner_income')} signed={false} sx={bold} />,
        note: <>Exit's share: {money(sum(days, 'exit_share'))}</>,
        info: "You earn once every customer's monthly bucket is full: the profit above that is split between you and Exit by your profit share.",
      },
    ]),
  ];

  const pCols = { xs: '1fr auto', md: '1.4fr repeat(6, 1fr)' };
  const cCols = { xs: '1fr auto', md: staff ? '1.3fr 1fr 1fr 0.9fr 0.7fr 1.5fr' : '1.3fr 1fr 0.9fr 0.7fr 1.5fr' };

  return (
    <>
      {title}

      <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 } }}>
        <Figures items={figures} />

        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
          <Panel title="Daily results">
            {dayList.length === 0
              ? <Typography color="text.secondary" sx={{ px: 3, py: 4, textAlign: 'center' }}>No results in {monthName(month)}.</Typography>
              : <Heatmap month={month} byDay={byDay} />}
          </Panel>

          <Panel title="Summary" action={<Pill tone={closed ? (unpaid ? 'attention' : 'good') : 'progress'} label={closed ? (unpaid ? 'Closed, not paid' : 'Closed') : 'Open'} />}>
            <Box sx={{ px: { xs: 2, md: 3 }, py: 1 }}>
              {[
                ['Trading days', dayList.length],
                ['Average per trading day', dayList.length ? <Signed value={total / dayList.length} /> : '–'],
                ['Profit days', dayList.filter(([, v]) => v > 0).length],
                ['Loss days', dayList.filter(([, v]) => v < 0).length],
                ['Best day', best ? <>{fmtDate(best[0], { day: 'numeric', month: 'short' })} · <Signed value={best[1]} /></> : '–'],
                ['Worst day', worst ? <>{fmtDate(worst[0], { day: 'numeric', month: 'short' })} · <Signed value={worst[1]} /></> : '–'],
                ['Customers', customers.length],
                ['Customers at their cap', `${full} of ${customers.length}`],
                ...(closed ? [['Payouts', `${money(paidOut)}${unpaid ? ' (not yet paid)' : ''}`]] : []),
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.1, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                  <Typography color="text.secondary">{k}</Typography>
                  <Box sx={{ fontWeight: 600, textAlign: 'right' }}>{v}</Box>
                </Box>
              ))}
            </Box>
          </Panel>
        </Box>

        {staff && partners.length > 0 && (
          <Panel title="By partner">
            <Box aria-hidden sx={{ ...tableHead, columnGap: 4, gridTemplateColumns: pCols.md, '& > :not(:first-of-type)': { textAlign: 'right' } }}>
              <span>Partner</span><span>Invested</span><span>Entered</span><span>Return</span><span>To customers</span><span>Partner earned</span><span>Exit share</span>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {partners.map((p) => (
                <Box
                  component="li" key={p.id}
                  sx={{
                    display: 'grid', columnGap: 4, rowGap: 0.5, ...tableRow, alignItems: 'baseline', gridTemplateColumns: pCols,
                    '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                  }}
                >
                  <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                  <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{money(p.invested)}</Box>
                  <Box sx={{ textAlign: 'right' }}><Signed value={p.entered} /></Box>
                  <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}><Pct value={pct(p.entered, p.invested)} /></Box>
                  <Pairs
                    sx={{ display: { xs: 'grid', md: 'none' }, gridColumn: '1 / -1', mt: 0.75 }}
                    items={[
                      ['Invested', money(p.invested)], ['Return', <Pct value={pct(p.entered, p.invested)} />],
                      ['To customers', money(p.to_customers)], ['Partner earned', money(p.partner_income)], ['Exit share', money(p.exit_share)],
                    ]}
                  />
                  {['to_customers', 'partner_income', 'exit_share'].map((k) => (
                    <Box key={k} sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{money(p[k])}</Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Panel>
        )}

        <Panel title={`Customers in ${monthName(month)}`}>
          {customers.length === 0 ? (
            <Typography color="text.secondary" sx={{ px: 3, py: 4, textAlign: 'center' }}>No customer results this month.</Typography>
          ) : (
            <>
              <Box aria-hidden sx={{ ...tableHead, gridTemplateColumns: cCols.md, columnGap: 4 }}>
                <span>Customer</span>{staff && <span>Partner</span>}
                <Box sx={{ textAlign: 'right' }}>Invested</Box><Box sx={{ textAlign: 'right' }}>Credited</Box><Box sx={{ textAlign: 'right' }}>Return</Box>
                <span>Monthly bucket</span>
              </Box>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {customers.slice(0, limit).map((c) => (
                  <Box component="li" key={c.customer_id} sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                    <Box
                      component="a" href={`#/customers/${c.customer_id}`}
                      sx={{ ...rowLink, ...tableRow, gridTemplateColumns: cCols, columnGap: 4, rowGap: 1, gridTemplateAreas: { xs: '"name amount" "meta meta" "cap cap"', md: 'none' } }}
                    >
                      <Box sx={{ gridArea: { xs: 'name', md: 'auto' }, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>{c.full_name}</Typography>
                        {staff && <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { md: 'none' } }}>{c.franchisees?.name}</Typography>}
                      </Box>
                      {staff && <Typography color="text.secondary" noWrap sx={{ display: { xs: 'none', md: 'block' } }}>{c.franchisees?.name}</Typography>}
                      <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{money(c.invested)}</Box>
                      <Box sx={{ gridArea: { xs: 'amount', md: 'auto' }, textAlign: 'right' }}><Signed value={c.credited} /></Box>
                      <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}><Pct value={pct(c.credited, c.invested)} /></Box>
                      <Typography variant="body2" color="text.secondary" sx={{ gridArea: 'meta', display: { md: 'none' } }}>
                        {money(c.invested)} invested · <Pct value={pct(c.credited, c.invested)} sx={{ fontWeight: 500 }} /> return
                      </Typography>
                      <Box sx={{ gridArea: { xs: 'cap', md: 'auto' } }}><CapMeter covered={c.covered} cap={c.cap} /></Box>
                    </Box>
                  </Box>
                ))}
              </Box>
              <ShowMore shown={limit} total={customers.length} onMore={() => setLimit(limit + PAGE_ROWS)} />
            </>
          )}
        </Panel>
      </Box>
    </>
  );
}
