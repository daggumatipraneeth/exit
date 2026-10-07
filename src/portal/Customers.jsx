import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, InputAdornment, Alert, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { supabase } from './supabase';
import { money } from '../finance';
import { line } from '../theme';
import { today, monthName, Panel, PageTitle, CapMeter, StatusChip, FilterChips, rowLink } from './ui';

const cols = { xs: '1fr auto', md: '1.4fr 0.8fr 0.9fr 1.6fr' };
const onboarding = ['draft', 'awaiting_signature', 'pending_approval'];

export default function Customers({ profile }) {
  const staff = profile.role !== 'franchisee';
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const month = `${today().slice(0, 7)}-01`;

  useEffect(() => {
    Promise.all([
      supabase.from('customers')
        .select('id, full_name, phone, status, franchisees(name), customer_capital(effective_from, amount)')
        .order('full_name'),
      supabase.from('customer_month_progress').select('customer_id, cap, covered').eq('month', month),
    ]).then(([c, p]) => {
      const err = c.error ?? p.error;
      if (err) return setError(err.message);
      const progress = Object.fromEntries(p.data.map((r) => [r.customer_id, r]));
      setCustomers(c.data.map((x) => ({
        ...x,
        capital: x.customer_capital.toSorted((a, b) => b.effective_from.localeCompare(a.effective_from))[0]?.amount,
        progress: progress[x.id],
      })));
    });
  }, [month]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (customers ?? []).filter((c) =>
      (show === 'all' || (show === 'onboarding' ? onboarding.includes(c.status) : c.status === show)) &&
      (!needle || c.full_name.toLowerCase().includes(needle) || c.phone.replace(/\s/g, '').includes(needle.replace(/\s/g, ''))));
  }, [customers, q, show]);

  if (error) return <Alert severity="error">Couldn't load customers: {error}</Alert>;
  if (!customers) return null;

  return (
    <>
      <PageTitle action={<Button variant="contained" startIcon={<AddIcon />} href="#/customers/new">Add customer</Button>}>
        Customers
      </PageTitle>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: 1.5, mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search by name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: { md: '1 1 auto' }, bgcolor: '#fff', '& .MuiOutlinedInput-root': { height: 40 } }}
          slotProps={{ htmlInput: { 'aria-label': 'Search customers' }, input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <FilterChips
          label="Filter by status"
          value={show}
          onChange={setShow}
          options={[
            ['all', 'All'], ['active', 'Active'], ['onboarding', 'Onboarding'],
            ...(staff ? [['pending_approval', `To approve (${customers.filter((c) => c.status === 'pending_approval').length})`]] : []),
            ['rejected', 'Rejected'],
          ]}
        />
      </Box>

      <Panel title={`${list.length} of ${customers.length} customers`}>
        <Box
          aria-hidden
          sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: cols.md, columnGap: 4, px: 3, py: 1.25, color: 'text.secondary', fontSize: 13, borderBottom: `1px solid ${line}` }}
        >
          <span>Customer</span><span>Status</span><Box sx={{ textAlign: 'right' }}>Capital</Box><span>{monthName(month)} cap</span>
        </Box>
        {list.length === 0 && (
          <Typography color="text.secondary" sx={{ px: { xs: 2, md: 3 }, py: 4, textAlign: 'center' }}>
            {customers.length ? 'No customers match your search.' : 'No customers yet.'}
          </Typography>
        )}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {list.map((c) => (
            <Box component="li" key={c.id} sx={{ '&:not(:last-of-type)': { borderBottom: `1px solid ${line}` } }}>
              <Box
                component="a"
                href={`#/customers/${c.id}`}
                sx={{
                  ...rowLink, columnGap: { xs: 2, md: 4 }, rowGap: 1, gridTemplateColumns: cols,
                  gridTemplateAreas: { xs: '"name status" "capital capital" "cap cap"', md: '"name status capital cap"' },
                  px: { xs: 2, md: 3 }, py: 2,
                }}
              >
                <Box sx={{ gridArea: 'name', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>{c.full_name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {c.phone}{staff && ` – ${c.franchisees.name}`}
                  </Typography>
                </Box>
                <Box sx={{ gridArea: 'status', justifySelf: { xs: 'end', md: 'start' } }}><StatusChip status={c.status} /></Box>
                <Box sx={{ gridArea: 'capital', display: 'flex', justifyContent: { xs: 'space-between', md: 'flex-end' }, fontWeight: 500 }}>
                  <Box component="span" sx={{ display: { md: 'none' }, color: 'text.secondary', fontWeight: 400 }}>Capital</Box>
                  {c.capital ? money(c.capital) : '–'}
                </Box>
                <Box sx={{ gridArea: 'cap' }}>
                  {c.progress ? <CapMeter covered={c.progress.covered} cap={c.progress.cap} /> : (
                    <Typography variant="body2" color="text.secondary">No trades this month</Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>
    </>
  );
}
