import { useEffect, useState } from 'react';
import { Box, Typography, Alert, Button } from '@mui/material';
import { supabase } from './supabase';
import { money } from '../finance';
import { ink, line } from '../theme';
import { today, pickerField, fmtDate, shortDate, monthName, sum, Signed, Panel, Field, CapMeter, StatusChip, Figures, BackLink, tableHead, phoneText } from './ui';
import { OnboardingSteps, Documents, EditDetailsDialog, AgreementDialog, BankDialog, canEdit, latestSigned, SigningLink } from './Onboarding';
import { CapitalPanel, AddMoneyDialog, EmergencyPanel } from './Capital';
import { CustomerLogin, CustomerPayouts } from './CustomerAccount';

const cols = { xs: '1fr auto', md: '1.2fr 1fr 1fr' };

export default function Customer({ profile, id }) {
  const staff = profile.role !== 'franchisee';
  const [c, setC] = useState(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // 'edit' | 'capital' | 'agreement' | 'bank'

  function load() {
    // In parallel: the customer, their decrypted PAN/Aadhaar (only for permitted viewers) and the latest agreement version.
    Promise.all([
      supabase.from('customers').select('id, franchisee_id, full_name, phone, email, dob, address, cap_pct, plan, bank_holder, bank_ifsc, bank_last4, status, reject_reason, created_at, franchisees(name), capital_movements(id, kind, amount, received_at, effective_from), customer_documents(kind, path, mime, uploaded_at), agreements(id, sign_token, token_expires_at, signed_at, signer_name, template_version)').eq('id', id).maybeSingle(),
      supabase.rpc('customer_pii', { p_customer: id }),
      supabase.from('agreement_templates').select('version').order('version', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([{ data, error }, { data: pii }, { data: t }]) => {
      if (error) return setError(error.message);
      if (!data) return setError('This customer does not exist or is not yours.');
      setC({ ...data, pan: pii?.[0]?.pan ?? null, aadhaar_last4: pii?.[0]?.aadhaar_last4 ?? null, latestVersion: t?.version });
    });
  }
  useEffect(load, [id]);
  const reload = () => { setDialog(null); load(); };

  useEffect(() => {
    let live = true;
    const start = `${month}-01`;
    const end = new Date(`${start}T00:00`); end.setMonth(end.getMonth() + 1);
    supabase.from('customer_days')
      .select('trade_date, credited, covered, cap')
      .eq('customer_id', id)
      .gte('trade_date', start)
      .lt('trade_date', end.toLocaleDateString('en-CA'))
      .order('trade_date', { ascending: false })
      .then(({ data, error }) => live && (error ? setError(error.message) : setDays(data)));
    return () => { live = false; };
  }, [id, month]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!c || !days) return null;

  const signed = latestSigned(c.agreements);
  const moves = c.capital_movements;
  const latest = days[0];
  const active = c.status === 'active';
  const live = active || c.status === 'closed'; // has results to show rather than onboarding steps
  const isAdmin = profile.role === 'admin';
  const outdated = active && signed && c.latestVersion > signed.template_version;
  const edit = canEdit(profile, c);
  const documents = <Documents customer={c} docs={c.customer_documents} edit={edit} onChanged={load} />;

  return (
    <>
      <BackLink href="#/customers">All customers</BackLink>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: { xs: '1.6rem', md: '2.1rem' } }}>
          {c.full_name}
        </Typography>
        <StatusChip status={c.status} />
      </Box>

      <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, minWidth: 0 }}>
          {!live && (
            <>
              <OnboardingSteps
                customer={c} profile={profile} capital={moves} agreements={c.agreements}
                onEdit={() => setDialog('edit')} onCapital={() => setDialog('capital')} onBank={() => setDialog('bank')} onChanged={load}
              />
              {documents}
            </>
          )}
          {live && <>
          <Figures
            items={[
              { label: `Credited in ${monthName(`${month}-01`)}`, value: <Signed value={sum(days, 'credited')} sx={{ fontWeight: 700 }} />, info: "The customer's share of the month's results so far: profit until their bucket is full, and their share of any loss." },
              { label: 'Bucket this month', value: latest ? money(latest.cap) : '–', note: `${Number(c.cap_pct)}% of capital`, info: 'The most profit this customer can receive this month: their cap % of the capital they had on the 1st, plus a pro-rated share for money added during the month. Profit above it goes to the partner and Exit.' },
            ]}
          />

          {latest && (
            <Panel sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Bucket as of {shortDate(latest.trade_date)}
              </Typography>
              <CapMeter covered={latest.covered} cap={latest.cap} thick />
            </Panel>
          )}

          <Panel
            title="Daily results"
            action={
              <Box
                component="input"
                type="month"
                aria-label="Choose a month"
                value={month}
                max={today().slice(0, 7)}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                sx={{ ...pickerField, fontWeight: 500, height: 36 }}
              />
            }
          >
            {days.length === 0 ? (
              <Typography color="text.secondary" sx={{ px: { xs: 2, md: 3 }, py: 4, textAlign: 'center' }}>
                No results in {monthName(`${month}-01`)}.
              </Typography>
            ) : (
              <>
                <Box
                  aria-hidden
                  sx={{
                    ...tableHead, gridTemplateColumns: cols.md, columnGap: 2, '& > :not(:first-of-type)': { textAlign: 'right' },
                  }}
                >
                  <span>Date</span><span>Credited</span><span>Bucket after</span>
                </Box>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {days.map((d) => (
                    <Box
                      component="li"
                      key={d.trade_date}
                      sx={{
                        display: 'grid', alignItems: 'baseline', columnGap: 2, rowGap: 0.5, px: { xs: 2, md: 3 }, py: 1.5,
                        gridTemplateColumns: cols,
                        '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` },
                        '& > :not(:first-of-type)': { textAlign: 'right' },
                      }}
                    >
                      <Box sx={{ fontWeight: 500 }}>
                        {fmtDate(d.trade_date, { weekday: 'short', day: 'numeric', month: 'short' })}
                        <Typography variant="caption" color="text.secondary" component="p" sx={{ display: { md: 'none' }, fontWeight: 400 }}>
                          Bucket {money(d.covered)} of {money(d.cap)}
                        </Typography>
                      </Box>
                      <Box><Signed value={d.credited} /></Box>
                      <Box sx={{ display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>{money(d.covered)} of {money(d.cap)}</Box>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Panel>
          <CustomerPayouts customer={c} />
          {documents}
          </>}
        </Box>

        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 } }}>
          <Panel title="Details" action={edit && <Button size="small" onClick={() => setDialog('edit')}>Edit</Button>}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: '1fr' }, px: { xs: 2, md: 3 }, py: 2.5 }}>
              <Field label="Phone">{phoneText(c.phone)}</Field>
              <Field label="Date of birth">{c.dob && shortDate(c.dob)}</Field>
              <Field label="PAN">{c.pan}</Field>
              <Field label="Aadhaar">{c.aadhaar_last4 && `XXXX XXXX ${c.aadhaar_last4}`}</Field>
              <Box sx={{ gridColumn: '1 / -1' }}><Field label="Email">{c.email}</Field></Box>
              <Box sx={{ gridColumn: '1 / -1' }}><Field label="Address">{c.address}</Field></Box>
              {staff && <Field label="Partner">{c.franchisees.name}</Field>}
              <Field label="Customer since">{shortDate(c.created_at)}</Field>
            </Box>
          </Panel>

          <Panel title="Bank account" action={edit && <Button size="small" onClick={() => setDialog('bank')}>{c.bank_last4 ? 'Change' : 'Add'}</Button>}>
            <Typography sx={{ px: { xs: 2, md: 3 }, py: 2 }} color={c.bank_last4 ? 'text.primary' : 'error'}>
              {c.bank_last4 ? `${c.bank_holder} · XXXX ${c.bank_last4} · ${c.bank_ifsc}` : 'Missing. Payouts need a bank account.'}
            </Typography>
          </Panel>

          {active && <CustomerLogin customer={c} />}

          <CapitalPanel customer={c} moves={moves} canAdd={(staff && c.status !== 'closed') || edit} isAdmin={isAdmin} onChanged={load} />

          {(active || c.status === 'closed') && <EmergencyPanel customer={c} isAdmin={isAdmin} onChanged={load} />}

          {signed && (
            <Panel title="Agreement" action={<Button size="small" onClick={() => setDialog('agreement')}>View</Button>}>
              <Box sx={{ px: { xs: 2, md: 3 }, py: 2, display: 'grid', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Signed by {signed.signer_name} on {shortDate(signed.signed_at)} (version {signed.template_version}).
                </Typography>
                {outdated && (
                  <>
                    <Alert severity="warning">Agreement out of date: version {c.latestVersion} has newer terms. Ask the customer to sign it.</Alert>
                    {staff && <SigningLink customer={c} agreements={c.agreements} onChanged={load} />}
                  </>
                )}
              </Box>
            </Panel>
          )}
        </Box>
      </Box>

      {dialog === 'edit' && <EditDetailsDialog customer={c} profile={profile} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog === 'capital' && <AddMoneyDialog customer={c} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog === 'agreement' && <AgreementDialog customerId={c.id} onClose={() => setDialog(null)} />}
      {dialog === 'bank' && <BankDialog customer={c} onClose={() => setDialog(null)} onSaved={reload} />}
    </>
  );
}
