// The customer's whole portal: one page from my_account(), which never includes the cap or cap %.
import { useEffect, useState } from 'react';
import { Box, Typography, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import { supabase } from './supabase';
import { money } from '../finance';
import { line } from '../theme';
import { fmtDate, shortDate, monthName, Signed, Panel, Field, Pill, Figures, PageTitle, StatusChip, errText, tableHead, phoneText } from './ui';
import { PasswordPanel } from './Account';
import { Heatmap } from './MonthView';

const pad = { px: { xs: 2, md: 3 } };

export default function MyAccount() {
  const [month, setMonth] = useState(null); // null = latest month with results
  const [a, setA] = useState(null);
  const [error, setError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [email, setEmail] = useState('');

  function load() {
    supabase.rpc('my_account', { p_month: month }).then(({ data, error }) => (error ? setError(errText(error)) : setA(data)));
  }
  useEffect(load, [month]);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);

  async function cancel() {
    const { error } = await supabase.rpc('cancel_withdrawal');
    if (error) setError(errText(error)); else load();
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!a) return null;

  const fixed = a.plan === 'fixed';
  const invested = 'Your money with Exit now. Each month is worked out on the amount you had on the 1st.';
  const days = a.days ?? [];
  const latest = days[0];
  const active = a.status === 'active';
  // A loss in the month that closes next comes off the withdrawal at that close.
  const next = a.next_close;
  const lossNote = !fixed && next && Number(next.result) < 0 &&
    `Your ${monthName(next.month)} result so far is ${money(next.result)}. It is taken off what you can withdraw when ${monthName(next.month)} closes.`;

  return (
    <>
      <PageTitle action={!active && <StatusChip status={a.status} />}>Hello, {a.name.split(' ')[0]}</PageTitle>

      <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, minWidth: 0 }}>
          <Figures
            items={fixed ? [
              { label: 'Amount invested', value: money(a.invested), info: invested },
              {
                label: `Fixed payout for ${monthName(a.month)}`, value: money(a.fixed_payout), note: 'Paid at the end of the month',
                info: 'On the fixed plan you get this amount every month, whatever the trading result.',
              },
            ] : [
              {
                label: latest ? `Latest day (${fmtDate(latest.date, { day: 'numeric', month: 'short' })})` : 'Latest day',
                value: latest ? <Signed value={latest.pnl} sx={{ fontWeight: 700 }} /> : '–',
                info: 'Your share of the most recent trading day, after charges.',
              },
              {
                label: `${monthName(a.month)} so far`,
                value: <Signed value={a.month_pnl} sx={{ fontWeight: 700 }} />,
                info: 'Your result for the month so far. A profit is paid after the month ends; a loss is made up from later profit before payouts restart.',
              },
              { label: 'Amount invested', value: money(a.invested), info: invested },
            ]}
          />

          {!fixed && Number(a.carried) < 0 && (
            <Alert severity="info">
              A loss of {money(-a.carried)} from earlier months is being recovered first. Payouts restart once it is made up.
            </Alert>
          )}

          {!fixed && (
            <Panel
              title="Daily P&L"
              action={(a.months?.length ?? 0) > 1 && (
                <TextField select size="small" value={a.month} onChange={(e) => setMonth(e.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Month' } }}>
                  {a.months.map((m) => <MenuItem key={m} value={m}>{monthName(m)}</MenuItem>)}
                </TextField>
              )}
            >
              {days.length === 0 ? (
                <Typography color="text.secondary" sx={{ ...pad, py: 4, textAlign: 'center' }}>No results in {monthName(a.month)} yet.</Typography>
              ) : (
                <>
                  <Heatmap month={a.month} byDay={Object.fromEntries(days.map((d) => [d.date, Number(d.pnl)]))} link={false} />
                  <Box aria-hidden sx={{ ...tableHead, gridTemplateColumns: '1fr auto' }}><span>Date</span><span>Profit / loss</span></Box>
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {days.map((d) => (
                      <Box component="li" key={d.date} sx={{ display: 'flex', justifyContent: 'space-between', ...pad, py: 1.25, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                        <span>{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <Signed value={d.pnl} />
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Panel>
          )}

          <Panel title="Payouts">
            {(a.payouts ?? []).length === 0 ? (
              <Typography color="text.secondary" sx={{ ...pad, py: 3 }}>
                No payouts yet. Payouts are sent to your bank account after each month ends.
              </Typography>
            ) : (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {a.payouts.map((p) => (
                  <Box component="li" key={`${p.month}${p.emergency}`} sx={{ display: 'flex', alignItems: 'center', gap: 2, ...pad, py: 1.5, '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 500 }}>{monthName(p.month)}</Typography>
                      {p.emergency ? (
                        <Typography variant="body2" color="text.secondary">Emergency exit: your capital and this month's result</Typography>
                      ) : Number(p.withdrawal) > 0 && (
                        <Typography variant="body2" color="text.secondary">Includes withdrawal of {money(p.withdrawal)}</Typography>
                      )}
                    </Box>
                    <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money(p.amount)}</Box>
                    {Number(p.amount) > 0 && (
                      <Pill tone={p.paid_at ? 'good' : 'progress'} label={p.paid_at ? `Paid ${shortDate(p.paid_at)}` : 'Processing'} />
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Panel>
        </Box>

        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 } }}>
          {active && (
            <Panel title="Withdraw money">
              <Box sx={{ ...pad, py: 2.5, display: 'grid', gap: 1.5 }}>
                {a.withdrawal ? (
                  <>
                    <Typography>
                      You asked to withdraw <strong>{money(a.withdrawal.amount)}</strong> on {shortDate(a.withdrawal.requested_at)}.
                      It will be sent with the next monthly payout.
                    </Typography>
                    <Button variant="outlined" color="error" onClick={cancel} sx={{ justifySelf: 'start' }}>Cancel request</Button>
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      You can withdraw up to {money(a.withdrawable)}. The money is sent with the next monthly payout.
                    </Typography>
                    {lossNote && <Alert severity="info">{lossNote}</Alert>}
                    <Button variant="contained" onClick={() => setWithdrawing(true)} disabled={Number(a.withdrawable) <= 0} sx={{ justifySelf: 'start' }}>
                      Request withdrawal
                    </Button>
                  </>
                )}
              </Box>
            </Panel>
          )}

          <Panel title="Your account">
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', ...pad, py: 2.5 }}>
              <Field label="Name">{a.name}</Field>
              <Field label="Mobile">{phoneText(a.phone)}</Field>
              <Field label="Plan">{fixed ? 'Fixed monthly payout' : 'Profit share'}</Field>
              <Field label="Partner">{a.partner?.name}</Field>
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Field label="Bank account">
                  {a.bank.last4 ? `${a.bank.holder} · XXXX ${a.bank.last4} · ${a.bank.ifsc}` : 'Not on file. Ask your partner to add it.'}
                </Field>
              </Box>
            </Box>
            {(a.deposits ?? []).length > 0 && (
              <Box sx={{ ...pad, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Money invested</Typography>
                {a.deposits.toReversed().map((d, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderTop: `1px solid ${line}` }}>
                    <span>{{ deposit: 'Added', withdrawal: 'Withdrawn', exit: 'Paid back', correction: 'Correction' }[d.kind]}, counts from {shortDate(d.date)}</span>
                    <Box component="span" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{money(d.amount, true)}</Box>
                  </Box>
                ))}
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ ...pad, pb: 2.5 }}>
              To add money or change these details, contact your partner{a.partner?.phone ? ` on ${phoneText(a.partner.phone)}` : ''}.
            </Typography>
          </Panel>

          {active && <EmergencyExit a={a} onChanged={load} />}

          <PasswordPanel email={email} />
        </Box>
      </Box>

      {withdrawing && <WithdrawDialog max={Number(a.withdrawable)} note={lossNote} onClose={() => setWithdrawing(false)} onSaved={() => { setWithdrawing(false); load(); }} />}
    </>
  );
}

// For when the customer needs the money now: Exit pays out at once on the results so far and closes the account.
function EmergencyExit({ a, onChanged }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [figures, setFigures] = useState(null);
  const [error, setError] = useState('');
  const requested = a.emergency?.status === 'requested';

  async function open() {
    setAsking(true);
    const { data } = await supabase.rpc('emergency_figures');
    setFigures(data);
  }
  async function call(fn, args) {
    const { error } = await supabase.rpc(fn, args);
    if (error) return setError(errText(error));
    setAsking(false); onChanged();
  }

  return (
    <Panel title="Emergency exit">
      <Box sx={{ ...pad, py: 2.5, display: 'grid', gap: 1.5 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {requested ? (
          <>
            <Typography>You asked for an emergency exit on {shortDate(a.emergency.requested_at)}. Exit will contact you and pay it out.</Typography>
            <Button variant="outlined" onClick={() => call('cancel_emergency_exit', {})} sx={{ justifySelf: 'start' }}>Cancel request</Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Need your money now? Exit pays it out straight away instead of at month end, and your account closes.
            </Typography>
            <Button variant="outlined" color="error" onClick={open} sx={{ justifySelf: 'start' }}>Request emergency exit</Button>
          </>
        )}
      </Box>
      <Dialog open={asking} onClose={() => setAsking(false)} fullWidth maxWidth="xs">
        <DialogTitle>Request an emergency exit?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {figures && (
            <Alert severity="info">
              {a.plan === 'fixed'
                ? <>You would get your capital back in full: <strong>{money(figures.payout)}</strong>. There is no fixed payout for the part of this month.</>
                : <>On today's figures you would get about <strong>{money(figures.payout)}</strong>: your capital plus this month's result so far
                  {Number(figures.carried) < 0 ? ', less the loss carried from earlier months' : ''}. The final amount uses the results up to the day Exit pays it.</>}
            </Alert>
          )}
          <TextField label="Reason (optional)" multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Typography variant="body2" color="text.secondary">Your account closes once it is paid out.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsking(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => call('request_emergency_exit', { p_reason: reason })}>Request</Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}

function WithdrawDialog({ max, note, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const tooMuch = n > max;

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc('request_withdrawal', { p_amount: n });
    setBusy(false);
    if (error) setError(errText(error)); else onSaved();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Request withdrawal</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Amount (₹)" type="number" inputMode="decimal" autoFocus value={amount}
          onChange={(e) => setAmount(e.target.value)} error={tooMuch}
          helperText={tooMuch ? `You can withdraw up to ${money(max)}.` : `Up to ${money(max)}. Withdrawing everything closes your account.`}
        />
        <Button variant="outlined" onClick={() => setAmount(String(max))} sx={{ justifySelf: 'start' }}>Withdraw everything ({money(max)})</Button>
        <Typography variant="body2" color="text.secondary">
          The amount is paid with the next monthly payout, together with that month's profit. You can cancel until then.
        </Typography>
        {note && <Alert severity="info">{note}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={busy || !(n > 0) || tooMuch}>Request</Button>
      </DialogActions>
    </Dialog>
  );
}
