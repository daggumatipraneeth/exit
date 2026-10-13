// Concurrency stress test: many separate database sessions at once (each op its own psql connection and transaction),
// the way several staff members and the auto-close job would hit the system together. Then the books must balance.
//   Phase 1: saving results and recording deposits for last month while the month is being closed.
//   Phase 2: this month: saving results, deposits, cap % changes and emergency exits, all at once.
// Expected refusals (a closed month, results made final by an emergency exit, a closed account) are counted, not failures.
// Anything else (a deadlock, a lost update, a books problem, a frozen day that changed) fails the run.
// WRITES TO THE LOCAL DATABASE (committed). Run on the local stack only, then `npx supabase db reset`.
// Usage: node scripts/stress-concurrency.mjs [workers=8] [opsPerWorker=40]
import { spawn, execFileSync } from 'node:child_process';

const WORKERS = Number(process.argv[2] ?? 8), OPS = Number(process.argv[3] ?? 40);
const ADMIN = '00000000-0000-0000-0000-00000000000a';
const TODAY = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const M = `${TODAY.slice(0, 7)}-01`;
const PM = (() => { const d = new Date(`${M}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const partners = ['f8000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-000000000002'];
const customers = Array.from({ length: 12 }, (_, i) => ({ id: `c8000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`, f: partners[i % 2] }));
const asAdmin = `set local role authenticated; set local request.jwt.claims = '{"sub":"${ADMIN}"}';`;
const EXPECTED = /is closed|are final because|account is not active|account is closed|already closed|Close earlier months first/;

const psqlSync = (sql) => execFileSync('docker', ['exec', '-i', 'supabase_db_exit', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'], { input: sql }).toString().trim();
function psql(sql) {
  return new Promise((resolve) => {
    const p = spawn('docker', ['exec', '-i', 'supabase_db_exit', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1']);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve(code === 0 ? null : (err.split('\n').find((l) => /ERROR/.test(l)) ?? err).trim()));
    p.stdin.end(sql);
  });
}
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const amount = () => ((Math.random() < 0.6 ? 1 : -1) * Math.random() * 20000).toFixed(2);

const tally = { ok: 0, expected: 0, unexpected: [] };
async function worker(ops) {
  for (let i = 0; i < OPS; i++) {
    const err = await psql(`begin; ${ops()} commit;`);
    if (!err) tally.ok++; else if (EXPECTED.test(err)) tally.expected++; else tally.unexpected.push(err);
  }
}

// ---------- setup (committed) ----------
psqlSync(`
insert into franchisees (id, name, profit_share_pct) values ('${partners[0]}', 'Stress A', 70), ('${partners[1]}', 'Stress B', 60) on conflict do nothing;
insert into franchisee_terms values ('${partners[0]}', 20), ('${partners[1]}', 10) on conflict do nothing;
insert into customers (id, franchisee_id, full_name, phone, plan, status)
  values ${customers.map((c, i) => `('${c.id}', '${c.f}', 'Stress ${i + 1}', '95000000${String(i + 1).padStart(2, '0')}', '${i % 5 === 4 ? 'fixed' : 'variable'}', 'active')`).join(',')}
  on conflict do nothing;
insert into agreements (customer_id, template_version, signed_at) select id, 1, now() from customers where full_name like 'Stress %';
insert into capital_movements (customer_id, effective_from, amount) select id, '${PM}', 100000 + (row_number() over (order by id)) * 10000 from customers where full_name like 'Stress %';
`);
console.log(`setup: 2 partners, ${customers.length} customers; last month ${PM}, this month ${M}, today ${TODAY}`);

// ---------- phase 1: last month's saves and deposits racing its close ----------
const pmDays = Array.from({ length: 28 }, (_, i) => addDays(PM, i));
const phase1 = () => {
  const r = Math.random();
  if (r < 0.75) return `${asAdmin} insert into daily_entries (franchisee_id, trade_date, amount) values ('${pick(partners)}', '${pick(pmDays)}', ${amount()})
    on conflict (franchisee_id, trade_date) do update set amount = excluded.amount;`;
  return `${asAdmin} insert into capital_movements (customer_id, received_at, amount) values ('${pick(customers).id}', '${pick(pmDays)} 10:00+05:30', ${(rnd(10) + 1) * 1000});`;
};
let closeResult;
await Promise.all([
  ...Array.from({ length: WORKERS }, () => worker(phase1)),
  (async () => { await new Promise((r) => setTimeout(r, 1500)); closeResult = await psql(`begin; ${asAdmin} select close_month('${PM}'); commit;`); })(),
]);
console.log(`phase 1: close ${closeResult ? `FAILED: ${closeResult}` : 'ok'}; ${tally.ok} saves ok, ${tally.expected} refused as expected, ${tally.unexpected.length} unexpected`);
if (closeResult) tally.unexpected.push(`close: ${closeResult}`);

// ---------- phase 2: this month's saves, deposits, cap changes and emergency exits, all at once ----------
const mDays = []; for (let d = M; d <= TODAY; d = addDays(d, 1)) mDays.push(d);
const phase2 = () => {
  const r = Math.random();
  if (r < 0.55) return `${asAdmin} insert into daily_entries (franchisee_id, trade_date, amount) values ('${pick(partners)}', '${pick(mDays)}', ${amount()})
    on conflict (franchisee_id, trade_date) do update set amount = excluded.amount;`;
  if (r < 0.75) return `${asAdmin} insert into capital_movements (customer_id, received_at, amount) values ('${pick(customers).id}', '${pick(mDays)} ${pick(['09:00', '23:30'])}+05:30', ${(rnd(10) + 1) * 1000});`;
  if (r < 0.85) return `${asAdmin} update customers set cap_pct = ${pick([5, 6, 7, 8])} where id = '${pick(customers).id}' and status = 'active';`;
  return `${asAdmin} select process_emergency_exit('${pick(customers).id}');`;
};
const before2 = tally.ok + tally.expected;
await Promise.all(Array.from({ length: WORKERS }, () => worker(phase2)));
console.log(`phase 2: ${tally.ok + tally.expected - before2} ops done (emergency exits processed: ${psqlSync("select count(*) from emergency_exits x join customers c on c.id = x.customer_id where c.full_name like 'Stress %' and x.status = 'processed'")})`);

// ---------- the books ----------
const books = psqlSync('select coalesce(json_agg(b), \'[]\') from check_books() b');
// Recomputing every open month from scratch must reproduce exactly what the concurrent saves left behind.
const drift = psqlSync(`
create temp table before as select customer_id, trade_date, credited, cap, capital from customer_days where franchisee_id in ('${partners.join("','")}');
select recompute_partner(id) from franchisees where id in ('${partners.join("','")}');
select count(*) from (select * from before except select customer_id, trade_date, credited, cap, capital from customer_days where franchisee_id in ('${partners.join("','")}')
                      union all
                      select customer_id, trade_date, credited, cap, capital from customer_days where franchisee_id in ('${partners.join("','")}') except select * from before) x;`).split('\n').pop();
console.log(`books: ${books === '[]' ? 'balance (check_books: 0 problems)' : books}`);
console.log(`recompute from scratch vs concurrent result: ${drift} differing rows`);
console.log(`totals: ${tally.ok} ok, ${tally.expected} refused as expected, ${tally.unexpected.length} unexpected errors`);
for (const e of tally.unexpected.slice(0, 10)) console.log(`  unexpected: ${e}`);
process.exit(tally.unexpected.length || books !== '[]' || drift !== '0' ? 1 : 0);
