// Money in and out of one customer: the capital ledger with Add money (counts from the next day, pro-rated bucket preview),
// and the emergency exit. All the maths is on the server; these screens only show what it worked out.
import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment, Link,
} from '@mui/material';
import Papa from 'papaparse';
import { supabase } from './supabase';
import { money } from '../finance';
import { line } from '../theme';
import { today, shortDate, Panel, Field, Pill, Pairs, errText, IST, istNowInput, istInputToISO } from './ui';

const kindLabel = { deposit: 'Deposit', withdrawal: 'Withdrawal', exit: 'Paid back', correction: 'Correction' };
const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST });

export const capitalOn = (moves, day) => moves.filter((m) => m.effective_from <= day).reduce((t, m) => t + Number(m.amount), 0);

// The bank's bulk-payment file (same layout for month payouts and emergency payouts). Returns names missing bank details.
export function downloadPayoutCsv(rows, name) {
  const csv = Papa.unparse({
    fields: ['Beneficiary name', 'Account number', 'IFSC', 'Amount', 'Narration', 'Customer', 'Partner'],
    data: rows.map((r) => [r.beneficiary_name, r.account_number, r.ifsc, Number(r.amount).toFixed(2), r.narration, r.customer, r.partner]),
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
  return rows.filter((r) => !r.account_number).map((r) => r.customer);
}

export function CapitalPanel({ customer: c, moves, canAdd, isAdmin, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [undoing, setUndoing] = useState(null);
  const [error, setError] = useState('');
  const now = capitalOn(moves, today());
  const pending = moves.filter((m) => m.effective_from > today()).reduce((t, m) => t + Number(m.amount), 0);

  async function undo(m) {
    setError(''); setUndoing(null);
    const { error } = await supabase.from('capital_movements').delete().eq('id', m.id);
    if (error) setError(errText(error)); else onChanged();
  }

  return (
    <Panel title="Capital and cap" action={canAdd && <Button size="small" onClick={() => setAdding(true)}>Add money</Button>}>
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, display: 'grid', gap: 2 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Current capital">{money(now)}</Field>
          {pending !== 0 && <Field label="Starting soon">{money(pending, true)}</Field>}
          <Field label="Monthly cap">{`${Number(c.cap_pct)}% of capital`}</Field>
          <Field label="Plan">{c.plan === 'fixed' ? 'Fixed monthly payout' : 'Profit share'}</Field>
        </Box>
        {moves.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Money in and out</Typography>
            {moves.toSorted((a, b) => b.effective_from.localeCompare(a.effective_from) || b.id - a.id).map((m) => (
              <Box key={m.id} sx={{ py: 0.75, borderTop: `1px solid ${line}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <span>{kindLabel[m.kind]}</span>
                  <Box component="span" sx={{ fontWeight: 500 }}>{money(m.amount, true)}</Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {m.received_at && `Received ${when(m.received_at)} · `}counts from {shortDate(m.effective_from)}
                  {(isAdmin || canAdd) && m.kind === 'deposit' && <> · <Link component="button" onClick={() => setUndoing(m)}>Undo</Link></>}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Dialog open={!!undoing} onClose={() => setUndoing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Undo this deposit?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {undoing && `${money(undoing.amount)}, counting from ${shortDate(undoing.effective_from)}, is removed. `}
            Results of open months are worked out again without it. Closed months can't change.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUndoing(null)}>Keep it</Button>
          <Button variant="contained" color="error" onClick={() => undo(undoing)}>Undo deposit</Button>
        </DialogActions>
      </Dialog>
      {adding && <AddMoneyDialog customer={c} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged(); }} />}
    </Panel>
  );
}

// Amount added (not a new total) and when it reached Exit. The server decides when it counts.
export function AddMoneyDialog({ customer: c, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState(istNowInput());
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const receivedAt = received && istInputToISO(received); // IST whatever the device's time zone

  useEffect(() => {
    if (!(n > 0) || !receivedAt) return setPreview(null);
    let live = true;
    supabase.rpc('deposit_preview', { p_customer: c.id, p_amount: n, p_received: receivedAt })
      .then(({ data }) => live && setPreview(data));
    return () => { live = false; };
  }, [n, receivedAt]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('capital_movements').insert({ customer_id: c.id, kind: 'deposit', amount: n, received_at: receivedAt });
    setBusy(false);
    if (error) setError(errText(error)); else onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add money for {c.full_name}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Amount received" type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)}
          helperText="Only the new money, not the new total."
          slotProps={{ htmlInput: { min: 1, inputMode: 'decimal' }, input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
        />
        <TextField
          label="Reached Exit's account on (India time)" type="datetime-local" value={received} onChange={(e) => setReceived(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: istNowInput() } }}
          helperText="It counts from the next day: received any time on the 15th, up to midnight, counts from the 16th."
        />
        {preview && (
          <Alert severity="info">
            Counts from <strong>{shortDate(preview.effective_from)}</strong>. Adds <strong>{money(preview.cap_added)}</strong> to
            that month's bucket ({preview.days} of {preview.days_in_month} days); full months after that count in full.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !(n > 0) || !received} onClick={save}>Add money</Button>
      </DialogActions>
    </Dialog>
  );
}

// Emergency exit on the customer's page: partner/staff can ask; an admin sees the figures, confirms and pays.
export function EmergencyPanel({ customer: c, isAdmin, onChanged }) {
  const [x, setX] = useState(undefined);
  const [figures, setFigures] = useState(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  function load() {
    supabase.from('emergency_exits').select('*').eq('customer_id', c.id).in('status', ['requested', 'processed']).maybeSingle()
      .then(({ data }) => setX(data ?? null));
    if (c.status === 'active') supabase.rpc('emergency_figures', { p_customer: c.id }).then(({ data }) => setFigures(data));
  }
  useEffect(load, [c.id, c.status]);

  async function call(fn, args) {
    setError('');
    const { error } = await supabase.rpc(fn, args);
    if (error) return setError(errText(error));
    setAsking(false); setConfirming(false); load(); onChanged?.();
  }
  async function file() {
    const { data, error } = await supabase.rpc('emergency_payout_file', { p_id: x.id });
    if (error) return setError(errText(error));
    const missing = downloadPayoutCsv(data, `exit-emergency-payout-${c.full_name.replace(/\W+/g, '-')}.csv`);
    if (missing.length) setError('No bank details on file. Add them, then download again.');
  }

  if (x === undefined || (c.status !== 'active' && !x)) return null;
  const done = x?.status === 'processed';
  return (
    <Panel title="Emergency exit">
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, display: 'grid', gap: 1.5 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {done ? (
          <>
            <Typography>Paid out {x.through ? `with results up to ${shortDate(x.through)}` : 'before any results this month'}. The account is closed.</Typography>
            <Breakdown f={{ ...x, carried: x.carried_in }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Pill tone={x.paid_at ? 'good' : 'progress'} label={x.paid_at ? `Paid ${shortDate(x.paid_at)}` : 'To be paid'} />
              {isAdmin && Number(x.payout) > 0 && <Button size="small" variant="outlined" onClick={file}>Download payout file</Button>}
              {isAdmin && !x.paid_at && Number(x.payout) > 0 && <Button size="small" onClick={() => call('mark_emergency_paid', { p_id: x.id })}>Mark paid</Button>}
            </Box>
          </>
        ) : x ? (
          <>
            <Alert severity="warning">
              Requested on {shortDate(x.requested_at)}{x.reason && `: ${x.reason}`}
            </Alert>
            {figures && <Breakdown f={figures} />}
            {figures?.blocked && <Typography variant="body2" color="error">{figures.blocked}.</Typography>}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isAdmin && <Button variant="contained" color="error" disabled={!!figures?.blocked} onClick={() => setConfirming(true)}>Pay out now</Button>}
              <Button onClick={() => call('cancel_emergency_exit', { p_customer: c.id })}>Cancel request</Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Pays the customer straight away and closes the account. Profit share: capital plus this month's result so far, less any
              loss carried. Fixed plan: capital in full, nothing for the part-month.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" color="error" onClick={() => setAsking(true)} sx={{ justifySelf: 'start' }}>Request emergency exit</Button>
              {isAdmin && <Button color="error" onClick={() => setConfirming(true)}>Pay out now</Button>}
            </Box>
          </>
        )}
      </Box>

      <Dialog open={asking} onClose={() => setAsking(false)} fullWidth maxWidth="xs">
        <DialogTitle>Request an emergency exit?</DialogTitle>
        <DialogContent>
          <TextField label="Reason (optional)" multiline minRows={2} fullWidth value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsking(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => call('request_emergency_exit', { p_reason: reason, p_customer: c.id })}>Request</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirming} onClose={() => setConfirming(false)} fullWidth maxWidth="xs">
        <DialogTitle>Pay out {c.full_name} now?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          {figures && <Breakdown f={figures} />}
          <Typography variant="body2" color="text.secondary">
            {figures?.through ? `Uses results up to ${shortDate(figures.through)}; enter today's result first if it should count. ` : ''}
            Those days become final for this partner. The account closes. This can't be undone.
          </Typography>
          {figures?.blocked && <Alert severity="error">{figures.blocked}.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={!figures || !!figures.blocked} onClick={() => call('process_emergency_exit', { p_customer: c.id })}>
            Pay {figures ? money(figures.payout) : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}

function Breakdown({ f }) {
  const fixed = f.plan === 'fixed';
  return (
    <Pairs sx={{ gridTemplateColumns: '1fr', rowGap: 0.75, '& > div': { display: 'flex !important' } }} items={[
      ['Capital', money(f.capital)],
      ...(fixed ? [] : [
        ['This month so far', money(f.result, true)],
        ...(Number(f.carried) < 0 ? [['Loss carried in', money(f.carried, true)]] : []),
      ]),
      ['Payout', <strong key="p">{money(f.payout)}</strong>],
    ]} />
  );
}
