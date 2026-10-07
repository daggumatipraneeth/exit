// Admin-only pages: month close, agreement template, activity log.
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, MenuItem, Stack, InputAdornment,
} from '@mui/material';
import { supabase } from './supabase';
import { money } from '../finance';
import { line } from '../theme';
import { today, monthName, shortDate, Panel, PageTitle, Signed, errText } from './ui';
import { AgreementFrame } from './Sign';

export function Months() {
  const [rows, setRows] = useState(null);
  const [closed, setClosed] = useState([]);
  const [confirm, setConfirm] = useState(null); // { month, close }
  const [error, setError] = useState('');
  const thisMonth = `${today().slice(0, 7)}-01`;

  function load() {
    Promise.all([
      supabase.from('franchisee_days').select('trade_date, net, to_customers, partner_income, exit_share, daily_entries(amount)'),
      supabase.from('closed_months').select('month, closed_at'),
    ]).then(([d, c]) => {
      if (d.error || c.error) return setError(errText(d.error ?? c.error));
      const by = {};
      for (const r of d.data) {
        const m = `${r.trade_date.slice(0, 7)}-01`;
        const t = (by[m] ??= { month: m, days: new Set(), customers: 0, partners: 0, exit: 0 });
        t.days.add(r.trade_date);
        const amount = Number(r.daily_entries.amount);
        t.customers += Number(r.to_customers);
        t.partners += Number(r.partner_income);
        t.exit += Number(r.exit_share) + (amount > 0 ? amount - Number(r.net) : 0); // share above buckets + hidden charge
      }
      setRows(Object.values(by).sort((a, b) => b.month.localeCompare(a.month)));
      setClosed(c.data);
    });
  }
  useEffect(load, []);

  async function apply() {
    const { month, close } = confirm;
    const { error } = close
      ? await supabase.from('closed_months').insert({ month })
      : await supabase.from('closed_months').delete().eq('month', month);
    setConfirm(null);
    if (error) return setError(errText(error));
    load();
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows) return null;
  const closedAt = Object.fromEntries(closed.map((c) => [c.month, c.closed_at]));

  return (
    <>
      <PageTitle>Months</PageTitle>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: '65ch' }}>
        Close a month once its figures are final and payouts are made. A closed month can't be edited, and later changes to capital
        or cap don't touch it.
      </Typography>
      <Panel>
        {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>No results entered yet.</Typography>}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((r) => {
            const isClosed = !!closedAt[r.month];
            return (
              <Box
                component="li"
                key={r.month}
                sx={{
                  display: 'grid', gap: { xs: 1.5, md: 3 }, alignItems: 'center', px: { xs: 2, md: 3 }, py: 2,
                  gridTemplateColumns: { xs: '1fr 1fr', md: '1.2fr repeat(3, 1fr) 1.2fr' },
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                  <Typography sx={{ fontWeight: 600 }}>{monthName(r.month)}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.days.size} trading days</Typography>
                </Box>
                <Box><Typography variant="body2" color="text.secondary">To customers</Typography><Signed value={r.customers} /></Box>
                <Box><Typography variant="body2" color="text.secondary">Partners</Typography><Signed value={r.partners} signed={false} /></Box>
                <Box><Typography variant="body2" color="text.secondary">Exit earned</Typography><Box sx={{ fontWeight: 600 }}>{money(r.exit)}</Box></Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}>
                  {isClosed && <Chip size="small" label={`Closed ${shortDate(closedAt[r.month].slice(0, 10))}`} />}
                  {!isClosed && r.month === thisMonth ? <Chip size="small" variant="outlined" label="In progress" /> : (
                    <Button size="small" variant={isClosed ? 'text' : 'outlined'} onClick={() => setConfirm({ month: r.month, close: !isClosed })}>
                      {isClosed ? 'Reopen' : 'Close month'}
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Panel>

      {confirm && (
        <Dialog open onClose={() => setConfirm(null)}>
          <DialogTitle>{confirm.close ? 'Close' : 'Reopen'} {monthName(confirm.month)}?</DialogTitle>
          <DialogContent>
            <Typography>
              {confirm.close
                ? 'Entries for this month will be locked. Partners keep seeing the final figures.'
                : 'Staff will be able to change entries for this month again, and its payouts can change.'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="contained" onClick={apply}>{confirm.close ? 'Close month' : 'Reopen month'}</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

const sample = { full_name: 'Anil Varma', pan: 'ABCDE1234F', franchisee: 'Ravi Kumar Associates', cap_pct: '6', capital: '₹1,00,000', date: '7 October 2026' };
const fill = (body) => body.replace(/\{\{(\w+)\}\}/g, (m, k) => sample[k] ?? m);

export function Templates() {
  const [list, setList] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');

  function load() {
    supabase.from('agreement_templates').select('*').order('version', { ascending: false })
      .then(({ data, error }) => (error ? setError(errText(error)) : setList(data)));
  }
  useEffect(load, []);

  async function save() {
    const { error } = await supabase.from('agreement_templates').insert({ title: draft.title.trim(), body: draft.body });
    if (error) return setError(errText(error));
    setDraft(null);
    load();
  }

  if (!list) return error ? <Alert severity="error">{error}</Alert> : null;
  const current = list[0];

  return (
    <>
      <PageTitle action={!draft && <Button variant="contained" onClick={() => setDraft({ title: current?.title ?? 'Client Trading Agreement', body: current?.body ?? '' })}>Write a new version</Button>}>
        Agreement
      </PageTitle>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: '70ch' }}>
        New signing links use the latest version. Agreements already signed keep the exact text the customer saw. Fill-ins:{' '}
        <code>{'{{full_name}} {{pan}} {{franchisee}} {{capital}} {{cap_pct}} {{date}}'}</code>.
      </Typography>

      {draft ? (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1fr 1fr' }, alignItems: 'start' }}>
          <Panel title="Edit (HTML)">
            <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
              <TextField label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <TextField
                label="Agreement text" multiline minRows={14} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                slotProps={{ htmlInput: { style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } } }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" disabled={!draft.title.trim() || !draft.body.trim()} onClick={save}>Publish version {(current?.version ?? 0) + 1}</Button>
                <Button onClick={() => setDraft(null)}>Cancel</Button>
              </Box>
            </Stack>
          </Panel>
          <Panel title="Preview with sample customer">
            <Box sx={{ p: { xs: 2, md: 3 } }}><AgreementFrame html={fill(draft.body)} key={draft.body} /></Box>
          </Panel>
        </Box>
      ) : current ? (
        <Panel title={`Version ${current.version}: ${current.title}`}>
          <Box sx={{ p: { xs: 2, md: 3 } }}><AgreementFrame html={fill(current.body)} /></Box>
          {list.length > 1 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
              Earlier versions: {list.slice(1).map((t) => `v${t.version} (${shortDate(t.created_at.slice(0, 10))})`).join(', ')}
            </Typography>
          )}
        </Panel>
      ) : (
        <Typography color="text.secondary">No agreement yet. Write the first version to start sending signing links.</Typography>
      )}
    </>
  );
}

const tableNames = {
  customers: 'Customer', daily_entries: 'Daily entry', franchisee_terms: 'Hidden charge', customer_capital: 'Capital', customer_documents: 'KYC document',
  agreements: 'Agreement', franchisees: 'Partner', profiles: 'Login', closed_months: 'Month', agreement_templates: 'Agreement template',
};
const verbs = { INSERT: 'added', UPDATE: 'changed', DELETE: 'removed' };
const quiet = new Set(['entered_at', 'uploaded_at', 'created_at', 'rendered_html', 'signature_png', 'html_sha256', 'body', 'sign_token']);
const PAGE = 50;

export function Activity() {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({ people: {}, customers: {}, partners: {} });
  const [table, setTable] = useState('all');
  const [more, setMore] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const byId = (rows, key) => Object.fromEntries((rows ?? []).map((x) => [x.id, x[key]]));
    Promise.all([
      supabase.from('profiles').select('id, full_name'), supabase.from('customers').select('id, full_name'), supabase.from('franchisees').select('id, name'),
    ]).then(([p, c, f]) => setNames({ people: byId(p.data, 'full_name'), customers: byId(c.data, 'full_name'), partners: byId(f.data, 'name') }));
  }, []);

  function load(from = 0) {
    let q = supabase.from('audit_log').select('*').order('id', { ascending: false }).range(from, from + PAGE - 1);
    if (table !== 'all') q = q.eq('table_name', table);
    q.then(({ data, error }) => {
      if (error) return setError(errText(error));
      setRows((r) => (from ? [...r, ...data] : data));
      setMore(data.length === PAGE);
    });
  }
  useEffect(() => load(0), [table]);

  const describe = useMemo(() => (r) => {
    const row = r.new ?? r.old;
    const who = row.full_name ?? row.name ?? names.customers[row.customer_id] ?? names.partners[row.franchisee_id] ?? row.month ?? row.title ?? '';
    let detail = '';
    if (r.op === 'UPDATE') {
      detail = Object.keys(r.new).filter((k) => !quiet.has(k) && JSON.stringify(r.new[k]) !== JSON.stringify(r.old[k]))
        .map((k) => `${k.replace(/_/g, ' ')}: ${r.old[k] ?? '–'} → ${r.new[k] ?? '–'}`).join('; ');
    } else if (r.table_name === 'daily_entries') {
      detail = `${row.trade_date}, ${money(row.amount, true)}`;
    } else if (r.table_name === 'customer_capital') {
      detail = `${money(row.amount)} from ${row.effective_from}`;
    } else if (r.table_name === 'customer_documents') {
      detail = row.kind?.replace(/_/g, ' ');
    }
    if (r.table_name === 'closed_months') return { what: r.op === 'DELETE' ? 'Month reopened' : 'Month closed', who: monthName(row.month), detail: '' };
    return { what: `${tableNames[r.table_name] ?? r.table_name} ${verbs[r.op]}`, who, detail };
  }, [names]);

  return (
    <>
      <PageTitle
        action={
          <TextField
            select size="small" value={table} onChange={(e) => setTable(e.target.value)}
            sx={{ minWidth: 220, bgcolor: '#fff', '& .MuiOutlinedInput-root': { height: 40 } }}
            slotProps={{ htmlInput: { 'aria-label': 'Show' }, input: { startAdornment: <InputAdornment position="start">Show</InputAdornment> } }}
          >
            <MenuItem value="all">Everything</MenuItem>
            {Object.entries(tableNames).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
        }
      >
        Activity
      </PageTitle>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Panel>
        {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>Nothing recorded yet.</Typography>}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((r) => {
            const d = describe(r);
            return (
              <Box
                component="li"
                key={r.id}
                sx={{
                  display: 'grid', gap: { xs: 0.25, md: 3 }, px: { xs: 2, md: 3 }, py: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: '11rem 1fr 10rem' }, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Typography variant="body2" color="text.secondary">{new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2"><strong>{d.what}</strong>{d.who && `: ${d.who}`}</Typography>
                  {d.detail && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{d.detail}</Typography>}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: { md: 'right' } }}>
                  {r.actor ? names.people[r.actor] ?? 'Unknown user' : 'System or customer'}
                </Typography>
              </Box>
            );
          })}
        </Box>
        {more && rows.length > 0 && <Box sx={{ p: 2, textAlign: 'center' }}><Button onClick={() => load(rows.length)}>Show older</Button></Box>}
      </Panel>
    </>
  );
}
