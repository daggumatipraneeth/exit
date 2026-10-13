// Admin-only pages: month close, agreement template, activity log.
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, InputAdornment,
} from '@mui/material';
import { supabase, fetchAll } from './supabase';
import { money } from '../finance';
import { line } from '../theme';
import { today, monthName, shortDate, Panel, PageTitle, Signed, Pairs, errText, Pill, IST } from './ui';
import { AgreementFrame } from './Sign';
import { downloadPayoutCsv } from './Capital';

export function Months() {
  const [rows, setRows] = useState(null);
  const [closed, setClosed] = useState([]);
  const [paid, setPaid] = useState({}); // month → { total, count, unpaid }
  const [confirm, setConfirm] = useState(null); // { month, close } or { month, pay }
  const [error, setError] = useState('');
  const [emergencies, setEmergencies] = useState([]);
  const thisMonth = `${today().slice(0, 7)}-01`;
  const lastDay = new Date(new Date(`${thisMonth}T00:00`).setMonth(new Date(`${thisMonth}T00:00`).getMonth() + 1) - 864e5).toLocaleDateString('en-CA');

  function load() {
    Promise.all([
      supabase.from('month_totals').select('*').order('month', { ascending: false }),
      supabase.from('closed_months').select('month, closed_at'),
      fetchAll((o) => supabase.from('settlements').select('month, payout_total, paid_at', o).gt('payout_total', 0).order('month').order('customer_id')),
      supabase.from('emergency_exits').select('id, customer_id, status, requested_at, processed_at, payout, paid_at, customers(full_name)')
        .or('status.eq.requested,and(status.eq.processed,paid_at.is.null)').order('requested_at'),
    ]).then(([d, c, s, em]) => {
      setEmergencies(em.data ?? []);
      if (d.error || c.error || s.error) return setError(errText(d.error ?? c.error ?? s.error));
      const by = {};
      for (const r of s.data) {
        const m = (by[r.month] ??= { total: 0, count: 0, unpaid: 0 });
        m.total += Number(r.payout_total); m.count += 1; if (!r.paid_at) m.unpaid += 1;
      }
      setPaid(by);
      setRows(d.data.map((r) => ({ month: r.month, days: r.trading_days, customers: r.to_customers, partners: r.partner_income, exit: r.exit_earned })));
      setClosed(c.data);
    });
  }
  useEffect(load, []);

  async function apply() {
    const { month, close, pay } = confirm;
    const { error } = await supabase.rpc(pay ? 'mark_paid' : close ? 'close_month' : 'reopen_month', { p_month: month });
    setConfirm(null);
    if (error) return setError(errText(error));
    load();
  }

  // The bank's bulk-payment file: one row per customer being paid that month.
  async function download(month) {
    const { data, error } = await supabase.rpc('payout_file', { p_month: month });
    if (error) return setError(errText(error));
    const missing = downloadPayoutCsv(data, `exit-payouts-${month.slice(0, 7)}.csv`);
    if (missing.length) setError(`No bank details for: ${missing.join(', ')}. Add them on each customer's page, then download again.`);
  }

  if (!rows) return error ? <Alert severity="error">{error}</Alert> : null;
  const closedAt = Object.fromEntries(closed.map((c) => [c.month, c.closed_at]));

  return (
    <>
      <PageTitle>Months</PageTitle>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: '65ch' }}>
        Once a month's figures are final: <strong>Close month</strong> (works out every customer's payout and withdrawal),
        <strong> Download payout file</strong> and send it to the bank, then <strong>Mark paid</strong> once the bank confirms.
        A closed month can't be edited. It can be reopened only until it is marked paid.
        Each month <strong>closes automatically at 11:30 PM on its last day</strong>; close it yourself earlier that day if the
        last results are already in. Buckets start fresh on the 1st either way.
      </Typography>
      {emergencies.length > 0 && (
        <Panel title="Emergency exits" sx={{ mb: 3 }}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {emergencies.map((x) => (
              <Box component="li" key={x.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, md: 3 }, py: 1.5, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography component="a" href={`#/customers/${x.customer_id}`} sx={{ fontWeight: 600, color: 'inherit' }}>{x.customers?.full_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {x.status === 'requested' ? `Requested ${shortDate(x.requested_at)}: open the customer to pay it out` : `Paid out ${shortDate(x.processed_at)}, ${money(x.payout)}`}
                  </Typography>
                </Box>
                <Pill tone={x.status === 'requested' ? 'attention' : 'progress'} label={x.status === 'requested' ? 'Requested' : 'To be paid'} />
              </Box>
            ))}
          </Box>
        </Panel>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Panel>
        {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>No results entered yet.</Typography>}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((r) => {
            const isClosed = !!closedAt[r.month];
            const pay = paid[r.month];
            const settled = isClosed && pay && !pay.unpaid;
            return (
              <Box
                component="li"
                key={r.month}
                sx={{
                  display: 'grid', gap: { xs: 1.5, md: 3 }, alignItems: 'center', px: { xs: 2, md: 3 }, py: 2,
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 3fr) minmax(0, 1fr)' },
                  '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{monthName(r.month)}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.days} trading days</Typography>
                </Box>
                <Pairs items={[['To customers', <Signed value={r.customers} />], ['Partners', <Signed value={r.partners} signed={false} />], ['Exit earned', money(r.exit)]]} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: { xs: `1px solid ${line}`, md: 'none' }, pt: { xs: 1.5, md: 0 } }}>
                  {isClosed && pay && (
                    <Typography variant="body2" color="text.secondary" sx={{ width: 1, textAlign: { md: 'right' } }}>
                      {money(pay.total)} to {pay.count} customer{pay.count === 1 ? '' : 's'}
                    </Typography>
                  )}
                  {isClosed && (
                    <Pill tone={pay?.unpaid ? 'attention' : 'good'} label={pay?.unpaid ? 'Closed, not paid' : settled ? 'Paid' : `Closed ${shortDate(closedAt[r.month])}`} />
                  )}
                  {isClosed && pay && <Button size="small" variant="outlined" onClick={() => download(r.month)}>Download payout file</Button>}
                  {isClosed && pay?.unpaid > 0 && <Button size="small" variant="contained" onClick={() => setConfirm({ month: r.month, pay: true })}>Mark paid</Button>}
                  {settled ? null : !isClosed && r.month === thisMonth && today() < lastDay ? <Pill tone="progress" label={`Closes ${shortDate(lastDay)}, 11:30 PM`} /> : (
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
          <DialogTitle>{confirm.pay ? 'Mark payouts paid for' : confirm.close ? 'Close' : 'Reopen'} {monthName(confirm.month)}?</DialogTitle>
          <DialogContent>
            <Typography>
              {confirm.pay
                ? 'Do this only after the bank confirms the transfers. Customers will see their payout as paid, and the month can no longer be reopened.'
                : confirm.close
                  ? "Entries are locked and each customer's payout is worked out, including any withdrawal requests. Customers see it as processing."
                  : 'The payouts for this month are removed, withdrawals go back to pending, and staff can change entries again.'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="contained" onClick={apply}>{confirm.pay ? 'Mark paid' : confirm.close ? 'Close month' : 'Reopen month'}</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

const sample = {
  full_name: 'Anil Varma', pan: 'ABCDE1234F', franchisee: 'Ravi Kumar Associates', cap_pct: '6', capital: '₹1,00,000', date: '7 October 2026',
  plan: 'Profit Share', mobile: '+91 98480 10001', bank: 'Anil Varma · account ending 0001 · IFSC SBIN0001234', partner_phone: '+91 90000 11111',
  plan_terms: 'The Client has chosen the <strong>Profit Share</strong> plan. (The paragraph for the customer’s plan appears here.)',
};
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
              Earlier versions: {list.slice(1).map((t) => `v${t.version} (${shortDate(t.created_at)})`).join(', ')}
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
  customers: 'Customer', daily_entries: 'Daily entry', franchisee_terms: 'Trade charges', capital_movements: 'Capital', customer_documents: 'KYC document',
  agreements: 'Agreement', franchisees: 'Partner', profiles: 'Login', closed_months: 'Month', agreement_templates: 'Agreement template',
  consultation_requests: 'Call-back request', settlements: 'Payout', withdrawal_requests: 'Withdrawal request', emergency_exits: 'Emergency exit',
};
const verbs = { INSERT: 'added', UPDATE: 'changed', DELETE: 'removed', PASSWORD: 'password reset' };
const quiet = new Set(['entered_at', 'uploaded_at', 'created_at', 'rendered_html_enc', 'signature_png', 'html_sha256', 'body', 'sign_token', 'pan_hash',
  'handled_at', 'handled_by', 'source_ip', 'path', 'mime', 'note', 'uploaded_by']);
// Encrypted values are never shown; a change is reported by name only.
const secret = { pan_enc: 'PAN updated', aadhaar_enc: 'Aadhaar updated', bank_account_enc: 'Bank account updated' };
// Timestamps in the log are ISO strings; show them the way the rest of the page does.
const readable = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: IST }) : v);
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
      fetchAll((o) => supabase.from('profiles').select('id, full_name', o).order('id')),
      fetchAll((o) => supabase.from('customers').select('id, full_name', o).order('id')),
      fetchAll((o) => supabase.from('franchisees').select('id, name', o).order('id')),
      // People whose logins were removed are still named from the log of that removal.
      supabase.from('audit_log').select('old').eq('table_name', 'profiles').eq('op', 'DELETE'),
    ]).then(([p, c, f, gone]) => setNames({
      people: { ...Object.fromEntries((gone.data ?? []).map((r) => [r.old.id, `${r.old.full_name} (removed)`])), ...byId(p.data, 'full_name') },
      customers: byId(c.data, 'full_name'),
      partners: byId(f.data, 'name'),
    }));
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
        .map((k) => {
          if (secret[k]) return secret[k];
          const show = (v) => (v == null ? '–' : k === 'franchisee_id' ? names.partners[v] ?? 'a removed partner' : readable(v));
          return `${k === 'franchisee_id' ? (r.table_name === 'consultation_requests' ? 'allocated to' : 'partner') : k.replace(/_/g, ' ')}: ${show(r.old[k])} → ${show(r.new[k])}`;
        }).join('; ');
    } else if (r.table_name === 'daily_entries') {
      detail = `${row.trade_date}, ${money(row.amount, true)}`;
    } else if (r.table_name === 'capital_movements') {
      detail = `${row.kind} ${money(row.amount, true)}, counts from ${row.effective_from}`;
    } else if (r.table_name === 'emergency_exits') {
      detail = row.status === 'processed' ? `paid out ${money(row.payout)}` : row.status;
    } else if (r.table_name === 'customer_documents') {
      detail = row.kind?.replace(/_/g, ' ');
    }
    if (r.table_name === 'closed_months') return { what: r.op === 'DELETE' ? 'Month reopened' : 'Month closed', who: monthName(row.month), detail: '' };
    const verb = r.op === 'PASSWORD' && r.actor === row.id ? 'password changed' : verbs[r.op]; // their own, vs reset by Exit
    return { what: `${tableNames[r.table_name] ?? r.table_name} ${verb}`, who, detail };
  }, [names]);

  return (
    <>
      <PageTitle
        action={
          <TextField
            select size="small" value={table} onChange={(e) => setTable(e.target.value)}
            sx={{ width: { xs: 150, sm: 'auto' }, minWidth: { sm: 220 }, bgcolor: '#fff', '& .MuiOutlinedInput-root': { height: 40 } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Show' },
              input: { startAdornment: <InputAdornment position="start" sx={{ display: { xs: 'none', sm: 'flex' } }}>Show</InputAdornment> },
            }}
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
            const by = r.actor ? names.people[r.actor] ?? 'Unknown user' : 'System or customer';
            // Phones: what happened on one line, then when and who; details cut to a single line.
            const oneLine = { whiteSpace: { xs: 'nowrap', md: 'normal' }, overflow: { xs: 'hidden', md: 'visible' }, textOverflow: 'ellipsis' };
            return (
              <Box
                component="li"
                key={r.id}
                sx={{
                  display: 'grid', gap: { xs: 0, md: 3 }, px: { xs: 2, md: 3 }, py: { xs: 1, md: 1.5 },
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '11rem 1fr 10rem' }, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                  {new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: IST })}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={oneLine}>
                    <strong>{d.what}</strong>{d.who && `: ${d.who}`}
                  </Typography>
                  {d.detail && (
                    <Typography variant="body2" color="text.secondary" sx={{ ...oneLine, overflowWrap: { md: 'anywhere' } }}>
                      {d.detail}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' }, ...oneLine }}>
                    {new Date(r.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST })} · {by}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>{by}</Typography>
              </Box>
            );
          })}
        </Box>
        {more && rows.length > 0 && <Box sx={{ p: 2, textAlign: 'center' }}><Button onClick={() => load(rows.length)}>Show older</Button></Box>}
      </Panel>
    </>
  );
}
