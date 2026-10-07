import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Alert, TextField, IconButton, ToggleButtonGroup, ToggleButton, InputAdornment,
} from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import UploadIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import Papa from 'papaparse';
import { supabase } from './supabase';
import { money } from '../finance';
import { ink, line, loss } from '../theme';
import { today, shift, fmtDate, Panel, PageTitle, Signed, errText } from './ui';

const fields = [
  ['trades_count', 'Trades', ''],
  ['gross_pnl', 'Gross profit / loss', '₹'],
  ['broker_charges', 'Broker charges', '₹'],
  ['other_charges', 'Other charges', '₹'],
];
const csvColumns = ['date', 'pan', 'name', 'trades', 'gross_pnl', 'broker_charges', 'other_charges'];

// Turns a form/CSV row into a daily_entries row, or an error message.
function toEntry(raw) {
  const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(/[,₹\s]/g, '')));
  const gross = num(raw.gross_pnl);
  const trades = num(raw.trades_count) ?? 0;
  const broker = num(raw.broker_charges) ?? 0;
  const other = num(raw.other_charges) ?? 0;
  if (gross === null || !Number.isFinite(gross)) return 'Gross profit / loss is missing';
  if (!Number.isInteger(trades) || trades < 0) return 'Trades must be a whole number';
  if (!Number.isFinite(broker) || broker < 0 || !Number.isFinite(other) || other < 0) return 'Charges must be 0 or more';
  return { trades_count: trades, gross_pnl: gross, broker_charges: broker, other_charges: other };
}

function HandEntry({ date, customers, closed, onSaved }) {
  const [entries, setEntries] = useState(null); // saved rows by customer
  const [form, setForm] = useState({});
  const [results, setResults] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    Promise.all([
      supabase.from('daily_entries').select('*').eq('trade_date', date),
      supabase.from('daily_results').select('customer_id, customer_today, franchisee_income').eq('trade_date', date),
    ]).then(([e, r]) => {
      if (e.error || r.error) return setMsg(['error', errText(e.error ?? r.error)]);
      const byId = Object.fromEntries(e.data.map((x) => [x.customer_id, x]));
      setEntries(byId);
      setResults(Object.fromEntries(r.data.map((x) => [x.customer_id, x])));
      setForm(Object.fromEntries(customers.map((c) => [c.id, Object.fromEntries(fields.map(([k]) => [k, byId[c.id]?.[k] ?? '']))])));
    });
  }
  useEffect(() => { setMsg(null); load(); }, [date, customers]);

  if (!entries) return null;
  const changed = customers.filter((c) => fields.some(([k]) => String(form[c.id][k]) !== String(entries[c.id]?.[k] ?? '')));

  async function save() {
    setBusy(true);
    setMsg(null);
    const upserts = [];
    const deletes = [];
    for (const c of changed) {
      const f = form[c.id];
      if (fields.every(([k]) => f[k] === '')) { if (entries[c.id]) deletes.push(c.id); continue; }
      const e = toEntry(f);
      if (typeof e === 'string') { setBusy(false); return setMsg(['error', `${c.full_name}: ${e}.`]); }
      upserts.push({ customer_id: c.id, trade_date: date, ...e });
    }
    const up = upserts.length ? await supabase.from('daily_entries').upsert(upserts, { onConflict: 'customer_id,trade_date' }) : {};
    const del = deletes.length ? await supabase.from('daily_entries').delete().eq('trade_date', date).in('customer_id', deletes) : {};
    setBusy(false);
    const err = up.error ?? del.error;
    if (err) return setMsg(['error', errText(err)]);
    setMsg(['success', `Saved ${upserts.length} ${upserts.length === 1 ? 'entry' : 'entries'}${deletes.length ? `, removed ${deletes.length}` : ''}. Payouts are recalculated.`]);
    load();
    onSaved?.();
  }

  const set = (id, k) => (e) => setForm({ ...form, [id]: { ...form[id], [k]: e.target.value } });

  return (
    <>
      {msg && <Alert severity={msg[0]} sx={{ mb: 2 }}>{msg[1]}</Alert>}
      <Panel
        title={`${customers.length} active customers`}
        action={
          <Button variant="contained" disabled={closed || busy || changed.length === 0} onClick={save}>
            {changed.length ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'No changes'}
          </Button>
        }
      >
        <Box
          aria-hidden
          sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '1.3fr repeat(4, 1fr) 1.1fr', columnGap: 2, px: 3, py: 1.25, color: 'text.secondary', fontSize: 13, borderBottom: `1px solid ${line}` }}
        >
          <span>Customer</span>{fields.map(([k, label]) => <span key={k}>{label}</span>)}<Box sx={{ textAlign: 'right' }}>Result</Box>
        </Box>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {customers.map((c) => {
            const r = results[c.id];
            const dirty = changed.includes(c);
            return (
              <Box
                component="li"
                key={c.id}
                sx={{
                  display: 'grid', alignItems: 'center', columnGap: 2, rowGap: 1.5, px: { xs: 2, md: 3 }, py: 1.5,
                  gridTemplateColumns: { xs: '1fr 1fr', md: '1.3fr repeat(4, 1fr) 1.1fr' },
                  bgcolor: dirty ? '#FFFBEB' : 'transparent',
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>{c.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">{c.franchisees.name}</Typography>
                </Box>
                {fields.map(([k, label, unit]) => (
                  <TextField
                    key={k}
                    size="small"
                    label={label}
                    value={form[c.id][k]}
                    onChange={set(c.id, k)}
                    disabled={closed}
                    sx={{ '& label': { display: { md: 'none' } }, '& legend': { display: { md: 'none' } } }}
                    slotProps={{
                      htmlInput: { inputMode: k === 'trades_count' ? 'numeric' : 'decimal', 'aria-label': `${label} for ${c.full_name}` },
                      input: unit ? { startAdornment: <InputAdornment position="start">{unit}</InputAdornment> } : undefined,
                    }}
                  />
                ))}
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, textAlign: { md: 'right' }, fontSize: 14 }}>
                  {r && !dirty ? (
                    <>
                      <Box>Customer <Signed value={r.customer_today} /></Box>
                      <Box sx={{ color: 'text.secondary' }}>Partner {money(r.franchisee_income)}</Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">{dirty ? 'Not saved' : 'No entry'}</Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
        {changed.length > 0 && !closed && (
          <Box sx={{ position: 'sticky', bottom: { xs: 64, md: 0 }, p: 1.5, bgcolor: '#fff', borderTop: `1px solid ${line}`, borderRadius: '0 0 8px 8px', textAlign: 'right' }}>
            <Button variant="contained" disabled={busy} onClick={save}>
              Save {changed.length} {changed.length === 1 ? 'change' : 'changes'}
            </Button>
          </Box>
        )}
      </Panel>
    </>
  );
}

function CsvUpload({ date, customers }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const byPan = useMemo(() => Object.fromEntries(customers.filter((c) => c.pan).map((c) => [c.pan, c])), [customers]);

  function template() {
    const csv = Papa.unparse({
      fields: csvColumns,
      data: customers.map((c) => [date, c.pan ?? '', c.full_name, '', '', '', '']),
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `exit-daily-${date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function read(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setMsg(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: ({ data }) => {
        const seen = new Set();
        setRows(data.map((raw, i) => {
          const line = i + 2; // header is line 1
          const c = byPan[(raw.pan ?? '').trim().toUpperCase()];
          const d = (raw.date ?? '').trim();
          let error = null;
          let entry = null;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d).getTime())) error = 'Date must look like 2026-10-07';
          else if (!c) error = `No active customer with PAN "${raw.pan ?? ''}"`;
          else if (seen.has(`${c.id}${d}`)) error = 'Same customer and date appears twice';
          else {
            entry = toEntry({ ...raw, trades_count: raw.trades });
            if (typeof entry === 'string') { error = entry; entry = null; }
          }
          if (c) seen.add(`${c.id}${d}`);
          return { line, name: c?.full_name ?? raw.name ?? '', date: d, error, entry: entry && { customer_id: c.id, trade_date: d, ...entry } };
        }));
      },
      error: (err) => setMsg(['error', err.message]),
    });
  }

  async function save() {
    setBusy(true);
    const good = rows.filter((r) => r.entry).map((r) => r.entry);
    const { error } = await supabase.from('daily_entries').upsert(good, { onConflict: 'customer_id,trade_date' });
    setBusy(false);
    if (error) return setMsg(['error', `Nothing was saved: ${errText(error)}`]);
    setMsg(['success', `Saved ${good.length} entries from ${fileName}. Payouts are recalculated.`]);
    setRows(null);
  }

  const bad = rows?.filter((r) => r.error) ?? [];
  const good = rows ? rows.length - bad.length : 0;

  return (
    <>
      {msg && <Alert severity={msg[0]} sx={{ mb: 2 }}>{msg[1]}</Alert>}
      <Panel title="Upload a CSV file">
        <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
          <Typography color="text.secondary" sx={{ maxWidth: '65ch' }}>
            One row per customer per day, matched by PAN. Columns: <code>{csvColumns.join(', ')}</code>. The name column is only
            there to help you read the file. Uploading a day again replaces that day's figures.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2.5 }}>
            <Button variant="contained" component="label" startIcon={<UploadIcon />}>
              Choose CSV file
              <input type="file" accept=".csv,text/csv" hidden onChange={read} />
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={template}>Download template for {fmtDate(date, { day: 'numeric', month: 'short' })}</Button>
          </Box>
        </Box>
      </Panel>

      {rows && (
        <Panel
          title={`${fileName}: ${good} ready, ${bad.length} with problems`}
          action={<Button variant="contained" disabled={busy || good === 0} onClick={save}>Save {good} {good === 1 ? 'entry' : 'entries'}</Button>}
          sx={{ mt: 3 }}
        >
          {bad.length > 0 && (
            <Alert severity="warning" sx={{ m: 2 }}>Rows with problems are skipped. Fix them in the file and upload it again.</Alert>
          )}
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {rows.map((r) => (
              <Box
                component="li"
                key={r.line}
                sx={{
                  display: 'grid', gridTemplateColumns: { xs: '3rem 1fr', md: '4rem 1fr 7rem 2fr' }, gap: 1.5, px: { xs: 2, md: 3 }, py: 1.25,
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Typography variant="body2" color="text.secondary">Line {r.line}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.name || '–'}</Typography>
                <Typography variant="body2" sx={{ gridColumn: { xs: '2', md: 'auto' } }}>{r.date}</Typography>
                <Typography variant="body2" sx={{ gridColumn: { xs: '2', md: 'auto' }, color: r.error ? loss : 'text.secondary' }}>
                  {r.error ?? `Gross ${money(r.entry.gross_pnl)}, charges ${money(r.entry.broker_charges + r.entry.other_charges)}`}
                </Typography>
              </Box>
            ))}
          </Box>
        </Panel>
      )}
    </>
  );
}

export default function DailyEntry() {
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState('hand');
  const [customers, setCustomers] = useState(null);
  const [closed, setClosed] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id, full_name, pan, franchisees(name)').eq('status', 'active'),
      supabase.from('closed_months').select('month'),
    ]).then(([c, m]) => {
      if (c.error || m.error) return setError(errText(c.error ?? m.error));
      setCustomers(c.data.sort((a, b) => a.franchisees.name.localeCompare(b.franchisees.name) || a.full_name.localeCompare(b.full_name)));
      setClosed(m.data.map((r) => r.month));
    });
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!customers) return null;
  const isClosed = closed.includes(`${date.slice(0, 7)}-01`);

  return (
    <>
      <PageTitle
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton aria-label="Previous day" onClick={() => setDate(shift(date, -1))}><ChevronLeft /></IconButton>
            <Box
              component="input" type="date" aria-label="Trading day" value={date} max={today()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              sx={{ font: 'inherit', fontWeight: 600, color: ink, border: `1px solid ${line}`, borderRadius: 1.5, bgcolor: '#fff', px: 1.5, py: 0.75, minHeight: 40 }}
            />
            <IconButton aria-label="Next day" disabled={date >= today()} onClick={() => setDate(shift(date, 1))}><ChevronRight /></IconButton>
          </Box>
        }
      >
        Daily entry
      </PageTitle>

      <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 2.5, bgcolor: '#fff' }} aria-label="How to enter results">
        <ToggleButton value="hand">Enter by hand</ToggleButton>
        <ToggleButton value="csv">Upload CSV</ToggleButton>
      </ToggleButtonGroup>

      {isClosed && <Alert severity="info" sx={{ mb: 2 }}>{fmtDate(date, { month: 'long', year: 'numeric' })} is closed. Reopen it from Months to make changes.</Alert>}

      {mode === 'hand'
        ? <HandEntry date={date} customers={customers} closed={isClosed} />
        : <CsvUpload date={date} customers={customers} />}
    </>
  );
}
