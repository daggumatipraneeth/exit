// On a customer's page (staff and their partner): the customer's own login, and their payouts and withdrawal.
import { useEffect, useState } from 'react';
import { Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { supabase } from './supabase';
import { money } from '../finance';
import { line } from '../theme';
import { monthName, shortDate, Panel, Pill, errText } from './ui';
import { tempPassword, adminUsers, ShareDetails } from './Partners';
import { mobile10 } from './Onboarding';

export function CustomerLogin({ customer: c }) {
  const [loginId, setLoginId] = useState(undefined); // undefined = loading, null = none yet
  const [made, setMade] = useState(null); // the password just set, to hand over
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    supabase.rpc('customer_login_id', { p_customer: c.id }).then(({ data }) => setLoginId(data ?? null));
  }, [c.id]);

  async function go() {
    setAsking(false);
    setBusy(true);
    setError('');
    const password = tempPassword();
    const problem = await adminUsers({ action: 'customer_login', customer_id: c.id, password });
    setBusy(false);
    if (problem) return setError(problem);
    setMade(password);
    setLoginId(loginId ?? 'new');
  }

  if (loginId === undefined) return null;
  return (
    <Panel title="Customer login">
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, display: 'grid', gap: 1.5 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography variant="body2" color="text.secondary">
          {loginId
            ? `The customer logs in with mobile ${mobile10(c.phone)} to see their daily results and payouts.`
            : 'Let the customer see their daily results and payouts. They log in with their mobile number.'}
        </Typography>
        {made ? (
          <>
            <ShareDetails label="Mobile" email={mobile10(c.phone)} password={made} title="Exit customer login" login="#/" />
            <Typography variant="body2" color="text.secondary">Share this privately. The customer can change the password after logging in.</Typography>
          </>
        ) : (
          <Button variant={loginId ? 'outlined' : 'contained'} onClick={() => setAsking(true)} disabled={busy} sx={{ justifySelf: 'start' }}>
            {loginId ? 'Reset password' : 'Create login'}
          </Button>
        )}
      </Box>
      <Dialog open={asking} onClose={() => setAsking(false)} fullWidth maxWidth="xs">
        <DialogTitle>{loginId ? `Reset ${c.full_name}'s password?` : `Create a login for ${c.full_name}?`}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {loginId
              ? 'Their current password stops working straight away. You get a new temporary password to share with them.'
              : `They log in with mobile ${mobile10(c.phone)} and a temporary password you share with them. They choose their own password at first login.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsking(false)}>Cancel</Button>
          <Button variant="contained" onClick={go}>{loginId ? 'Reset password' : 'Create login'}</Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}

export function CustomerPayouts({ customer: c }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  function load() {
    supabase.from('settlements').select('month, result, carried_out, payout_total, withdrawal, paid_at')
      .eq('customer_id', c.id).order('month', { ascending: false })
      .then(({ data, error }) => (error ? setError(errText(error)) : setRows(data)));
    supabase.from('withdrawal_requests').select('amount, requested_at').eq('customer_id', c.id).eq('status', 'open')
      .maybeSingle().then(({ data }) => setOpen(data));
  }
  useEffect(load, [c.id]);

  async function cancel() {
    const { error } = await supabase.rpc('cancel_withdrawal', { p_customer: c.id });
    if (error) setError(errText(error)); else load();
  }

  if (!rows) return error ? <Alert severity="error">{error}</Alert> : null;
  return (
    <Panel title="Payouts">
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      {open && (
        <Alert severity="warning" sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={cancel}>Cancel it</Button>}>
          Withdrawal of {money(open.amount)} requested on {shortDate(open.requested_at)}. It is paid at the next month close.
        </Alert>
      )}
      {rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ px: { xs: 2, md: 3 }, py: 3 }}>No closed months yet.</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((r) => (
            <Box component="li" key={r.month} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, md: 3 }, py: 1.5, borderTop: `1px solid ${line}` }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>{monthName(r.month)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Result {money(r.result, true)}
                  {Number(r.withdrawal) > 0 && ` · withdrawal ${money(r.withdrawal)}`}
                  {Number(r.carried_out) < 0 && ` · loss carried ${money(r.carried_out)}`}
                </Typography>
              </Box>
              <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money(r.payout_total)}</Box>
              {Number(r.payout_total) > 0 && <Pill tone={r.paid_at ? 'good' : 'progress'} label={r.paid_at ? 'Paid' : 'Processing'} />}
            </Box>
          ))}
        </Box>
      )}
    </Panel>
  );
}
