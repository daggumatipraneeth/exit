import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Alert, TextField, IconButton, InputAdornment } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import UploadIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import Papa from 'papaparse';
import { supabase } from './supabase';
import { money, splitByWeight } from '../finance';
import { ink, line, loss } from '../theme';
import { today, shift, fmtDate, Panel, PageTitle, Signed, FilterChips, errText } from './ui';

const csvColumns = ['date', 'partner', 'amount'];
const cols = { xs: '1fr', md: '1.3fr 1fr 1.6fr' };

// "1,20,000" / "₹ -500" / "" → number, null when blank, NaN when not a number.
const toAmount = (v) => (v == null || String(v).trim() === '' ? null : Number(String(v).replace(/[,₹\s]/g, '')));

function HandEntry({ date, partners, closed }) {
  const [saved, setSaved] = useState(null); // amount by partner
  const [stamps, setStamps] = useState({}); // entered_at by partner, to spot someone else's save
  const [form, setForm] = useState({});
  const [results, setResults] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState('');
  const [shares, setShares] = useState(null); // capital and % by partner, after a split

  // Inputs stay hidden until this date's figures arrive, so a slow response can't wipe what someone typed.
  function load(isLive = () => true) {
    Promise.all([
      supabase.from('daily_entries').select('franchisee_id, amount, entered_at').eq('trade_date', date),
      supabase.from('franchisee_days').select('franchisee_id, net, to_customers, partner_income, exit_share').eq('trade_date', date),
    ]).then(([e, r]) => {
      if (!isLive()) return; // the date changed while loading
      if (e.error || r.error) return setMsg(['error', errText(e.error ?? r.error)]);
      const byId = Object.fromEntries(e.data.map((x) => [x.franchisee_id, x.amount]));
      setSaved(byId);
      setStamps(Object.fromEntries(e.data.map((x) => [x.franchisee_id, x.entered_at])));
      setResults(Object.fromEntries(r.data.map((x) => [x.franchisee_id, x])));
      setForm(Object.fromEntries(partners.map((p) => [p.id, byId[p.id] ?? ''])));
    });
  }
  useEffect(() => {
    let live = true;
    setMsg(null);
    setSaved(null);
    setShares(null);
    load(() => live);
    return () => { live = false; };
  }, [date, partners]);

  if (!saved) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading {fmtDate(date, { day: 'numeric', month: 'long' })}…</Typography>;
  const changed = partners.filter((p) => String(form[p.id]) !== String(saved[p.id] ?? ''));

  // Each change only applies if the partner's day is still as it was when this screen loaded.
  // If someone else saved it meanwhile, nothing of theirs is overwritten: their figure is shown instead.
  async function save() {
    const inserts = [];
    const updates = [];
    const deletes = [];
    for (const p of changed) {
      const v = toAmount(form[p.id]);
      if (v !== null && !Number.isFinite(v)) return setMsg(['error', `${p.name}: enter a number, like 15000 or -3500.`]);
      if (saved[p.id] == null) inserts.push({ franchisee_id: p.id, trade_date: date, amount: v });
      else if (v === null) deletes.push(p);
      else updates.push([p, v]);
    }
    setBusy(true);
    setMsg(null);
    const conflicts = [];
    let err = null;
    if (inserts.length) {
      const { error } = await supabase.from('daily_entries').insert(inserts);
      if (error?.code === '23505') conflicts.push(...partners.filter((p) => inserts.some((r) => r.franchisee_id === p.id)));
      else err ??= error;
    }
    for (const [p, v] of updates) {
      const { data, error } = await supabase.from('daily_entries').update({ amount: v })
        .eq('franchisee_id', p.id).eq('trade_date', date).eq('entered_at', stamps[p.id]).select('franchisee_id');
      if (error) err ??= error; else if (!data.length) conflicts.push(p);
    }
    for (const p of deletes) {
      const { data, error } = await supabase.from('daily_entries').delete()
        .eq('franchisee_id', p.id).eq('trade_date', date).eq('entered_at', stamps[p.id]).select('franchisee_id');
      if (error) err ??= error; else if (!data.length) conflicts.push(p);
    }
    setBusy(false);
    load();
    if (err) {
      const closedNow = /Month (\w+ \d{4}) is closed/.exec(errText(err));
      return setMsg(['error', closedNow
        ? `${closedNow[1]} was closed while you were editing, so nothing was saved. Ask an admin to reopen it if this figure needs changing.`
        : errText(err)]);
    }
    if (conflicts.length) {
      return setMsg(['warning', `Someone else saved ${conflicts.map((p) => p.name).join(', ')} for this day while you were editing, so your change there wasn't applied. Their figure is shown now; change it and save again if needed.`]);
    }
    const n = inserts.length + updates.length;
    const parts = [n && `Saved ${n} ${n === 1 ? 'partner' : 'partners'}`, deletes.length && `${n ? 'removed' : 'Removed'} ${deletes.length}`].filter(Boolean);
    setMsg(['success', `${parts.join(', ')}. Customer shares are recalculated.`]);
  }

  // One figure for the whole day, split across partners by their customers' capital (as payouts count it).
  async function split() {
    const t = toAmount(total);
    if (t === null || !Number.isFinite(t)) return setMsg(['error', 'Enter the total, like 100000 or -25000.']);
    const { data, error } = await supabase.rpc('partner_capital_on', { p_date: date });
    if (error) return setMsg(['error', errText(error)]);
    const cap = Object.fromEntries(data.map((r) => [r.franchisee_id, Number(r.capital)]));
    const weights = partners.map((p) => cap[p.id] ?? 0);
    const sum = weights.reduce((a, w) => a + w, 0);
    if (!sum) return setMsg(['error', `No partner has active customers with capital on ${fmtDate(date, { day: 'numeric', month: 'long' })}, so there is nothing to split by.`]);
    const parts = splitByWeight(t, weights);
    setForm(Object.fromEntries(partners.map((p, i) => [p.id, weights[i] ? String(parts[i]) : (saved[p.id] ?? '')])));
    setShares(Object.fromEntries(partners.map((p, i) => [p.id, { capital: weights[i], pct: (weights[i] / sum) * 100 }])));
    setMsg(['info', `${money(t, true)} split across ${weights.filter(Boolean).length} partners by their customers' capital. Check the figures, then save.`]);
  }

  const saveButton = (
    <Button variant="contained" disabled={closed || busy || changed.length === 0} onClick={save}>
      {changed.length ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'No changes'}
    </Button>
  );

  return (
    <>
      {msg && <Alert severity={msg[0]} sx={{ mb: 2 }}>{msg[1]}</Alert>}
      <Panel title="Split a total" sx={{ mb: 3 }}>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); split(); }} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1.5, px: { xs: 2, md: 3 }, py: 2 }}>
          <TextField
            size="small" label="Total profit / loss for the day" value={total} onChange={(e) => setTotal(e.target.value)} disabled={closed}
            helperText="Each partner gets a share in proportion to their customers' capital."
            sx={{ flex: '1 1 260px', maxWidth: 420 }}
            slotProps={{ htmlInput: { inputMode: 'decimal' }, input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
          />
          <Button type="submit" variant="outlined" disabled={closed || !total.trim()}>Split by capital</Button>
        </Box>
      </Panel>
      <Panel title={`${partners.length} active partners`} action={saveButton}>
        <Box aria-hidden sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: cols.md, columnGap: 3, px: 3, py: 1.25, color: 'text.secondary', fontSize: 13, borderBottom: `1px solid ${line}` }}>
          <span>Partner</span><span>Profit / loss after broker charges</span><span>Result</span>
        </Box>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {partners.map((p) => {
            const r = results[p.id];
            const dirty = changed.includes(p);
            return (
              <Box
                component="li"
                key={p.id}
                sx={{
                  display: 'grid', alignItems: 'center', columnGap: 3, rowGap: 1.25, px: { xs: 2, md: 3 }, py: 1.75,
                  gridTemplateColumns: cols, bgcolor: dirty ? '#FFFBEB' : 'transparent',
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Hidden charge {Number(p.franchisee_terms?.hidden_charge_pct ?? 0)}%, partner keeps {Number(p.profit_share_pct)}% above buckets
                  </Typography>
                  {shares && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      {shares[p.id].capital ? `Capital ${money(shares[p.id].capital)} · ${shares[p.id].pct.toFixed(1)}% of the total` : 'No customer capital on this day, so no share'}
                    </Typography>
                  )}
                </Box>
                <TextField
                  size="small"
                  value={form[p.id]}
                  onChange={(e) => setForm({ ...form, [p.id]: e.target.value })}
                  disabled={closed}
                  placeholder="0"
                  slotProps={{
                    htmlInput: { inputMode: 'decimal', 'aria-label': `Profit or loss for ${p.name}` },
                    input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                  }}
                />
                <Box sx={{ fontSize: 14 }}>
                  {r && !dirty ? (
                    <>
                      <Box>Partner sees <Signed value={r.net} />, customers <Signed value={r.to_customers} /></Box>
                      <Box sx={{ color: 'text.secondary' }}>Partner earned {money(r.partner_income)}, Exit share {money(r.exit_share)}</Box>
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
            {saveButton}
          </Box>
        )}
      </Panel>
    </>
  );
}

function CsvUpload({ date, partners }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const byName = useMemo(() => Object.fromEntries(partners.map((p) => [p.name.trim().toLowerCase(), p])), [partners]);

  function template() {
    const csv = Papa.unparse({ fields: csvColumns, data: partners.map((p) => [date, p.name, '']) });
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
          const p = byName[(raw.partner ?? '').trim().toLowerCase()];
          const d = (raw.date ?? '').trim();
          const amount = toAmount(raw.amount);
          let error = null;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d).getTime())) error = 'Date must look like 2026-10-07';
          else if (!p) error = `No active partner named "${raw.partner ?? ''}"`;
          else if (seen.has(`${p.id}${d}`)) error = 'Same partner and date appears twice';
          else if (amount === null) error = 'Amount is missing';
          else if (!Number.isFinite(amount)) error = 'Amount must be a number';
          if (p) seen.add(`${p.id}${d}`);
          return { line: i + 2, name: p?.name ?? raw.partner ?? '', date: d, error, entry: !error && { franchisee_id: p.id, trade_date: d, amount } };
        }));
      },
      error: (err) => setMsg(['error', err.message]),
    });
  }

  async function save() {
    setBusy(true);
    const good = rows.filter((r) => r.entry).map((r) => r.entry);
    const { error } = await supabase.from('daily_entries').upsert(good, { onConflict: 'franchisee_id,trade_date' });
    setBusy(false);
    if (error) return setMsg(['error', `Nothing was saved: ${errText(error)}`]);
    setMsg(['success', `Saved ${good.length} entries from ${fileName}. Customer shares are recalculated.`]);
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
            One row per partner per day. Columns: <code>{csvColumns.join(', ')}</code>. Partner is the partner's name exactly as on the
            Partners page; amount is the day's profit or loss after broker charges. Uploading a day again replaces it.
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
          {bad.length > 0 && <Alert severity="warning" sx={{ m: 2 }}>Rows with problems are skipped. Fix them in the file and upload it again.</Alert>}
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {rows.map((r) => (
              <Box
                component="li"
                key={r.line}
                sx={{
                  display: 'grid', gridTemplateColumns: { xs: '3.5rem 1fr', md: '4rem 1.5fr 7rem 2fr' }, gap: 1.5, px: { xs: 2, md: 3 }, py: 1.25,
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Typography variant="body2" color="text.secondary">Line {r.line}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.name || '–'}</Typography>
                <Typography variant="body2" sx={{ gridColumn: { xs: '2', md: 'auto' } }}>{r.date}</Typography>
                <Typography variant="body2" sx={{ gridColumn: { xs: '2', md: 'auto' }, color: r.error ? loss : 'text.secondary' }}>
                  {r.error ?? money(r.entry.amount, true)}
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
  const [partners, setPartners] = useState(null);
  const [closed, setClosed] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('franchisees').select('id, name, profit_share_pct, franchisee_terms(hidden_charge_pct)').eq('active', true).order('name'),
      supabase.from('closed_months').select('month'),
    ]).then(([p, m]) => {
      if (p.error || m.error) return setError(errText(p.error ?? m.error));
      setPartners(p.data);
      setClosed(m.data.map((r) => r.month));
    });
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!partners) return null;
  const isClosed = closed.includes(`${date.slice(0, 7)}-01`);

  return (
    <>
      <PageTitle>Daily entry</PageTitle>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 2.5 }}>
        <FilterChips label="How to enter results" value={mode} onChange={setMode} options={[['hand', 'Enter by hand'], ['csv', 'Upload CSV']]} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: { xs: 'flex-start', sm: 'auto' }, ml: { xs: -1, sm: 0 } }}>
          <IconButton aria-label="Previous day" onClick={() => setDate(shift(date, -1))}><ChevronLeft /></IconButton>
          <Box
            component="input" type="date" aria-label="Trading day" value={date} max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            sx={{ font: 'inherit', fontWeight: 600, color: ink, border: `1px solid ${line}`, borderRadius: 1.5, bgcolor: '#fff', px: 1.5, height: 40 }}
          />
          <IconButton aria-label="Next day" disabled={date >= today()} onClick={() => setDate(shift(date, 1))}><ChevronRight /></IconButton>
        </Box>
      </Box>

      {isClosed && <Alert severity="info" sx={{ mb: 2 }}>{fmtDate(date, { month: 'long', year: 'numeric' })} is closed. Reopen it from Months to make changes.</Alert>}

      {mode === 'hand'
        ? <HandEntry date={date} partners={partners} closed={isClosed} />
        : <CsvUpload date={date} partners={partners} />}
    </>
  );
}
