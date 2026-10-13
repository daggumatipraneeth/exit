// Fuzz test: random scenarios run through the real SQL (in a rolled-back transaction), checked against an
// independent simulator written from the written rules, in exact integer paise (BigInt), plus check_books().
// Needs the local stack (npm run db:start; it uses the supabase_db_exit container) and the seed.
// Usage: node scripts/fuzz-payouts.mjs [scenarios=200] [startSeed=1]   (a failing seed can be replayed alone)
import { execFileSync } from 'node:child_process';

const N = Number(process.argv[2] ?? 200), START = Number(process.argv[3] ?? 1);
const ADMIN = '00000000-0000-0000-0000-00000000000a';
const P = 'f7000000-0000-0000-0000-000000000001';
const cid = (i) => `c7000000-0000-0000-0000-${String(i).padStart(12, '0')}`;

// ---------- dates (all IST calendar dates as 'YYYY-MM-DD') ----------
const nowIst = new Date(Date.now() + 5.5 * 3600e3);
const TODAY = nowIst.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const monthOf = (d) => `${d.slice(0, 7)}-01`;
const nextMonth = (m) => { const x = new Date(`${m}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + 1); return x.toISOString().slice(0, 10); };
const prevMonth = (m) => { const x = new Date(`${m}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() - 1); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400e3);
const M = monthOf(TODAY), PM = prevMonth(M);

// Effective date from an IST received date + time: before 12:00 → +1 day, from 12:00 → +2.
const effective = (date, hhmmss) => addDays(date, hhmmss < '12:00:00' ? 1 : 2);

// ---------- exact money ----------
const B = BigInt;
const rup = (paise) => (Number(paise) / 100).toFixed(2);
const P2 = (rupees) => B(Math.round(Number(rupees) * 100));
// round(num/den) half away from zero, den > 0
const roundDiv = (num, den) => { const s = num < 0n ? -1n : 1n; const a = num < 0n ? -num : num; return s * ((2n * a + den) / (2n * den)); };

// ---------- random ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function scenario(seed) {
  const r = rng(seed * 2654435761);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const hidden = pick([0, 10, 20, 25]), share = pick([50, 60, 70, 80]);
  const n = int(1, 5);
  const customers = Array.from({ length: n }, (_, i) => ({ i: i + 1, id: cid(i + 1), plan: r() < 0.25 ? 'fixed' : 'variable', capPct: pick([6, 6, 6, 5, 8]) }));
  const deposits = [];
  const pmDays = daysBetween(PM, M), mDaysSoFar = daysBetween(M, TODAY) + 1;
  for (const c of customers) {
    // first deposit somewhere in the previous month (some on its very first moments, some late, some on the last afternoon)
    const d = addDays(PM, r() < 0.35 ? -1 : int(0, pmDays - 1));
    deposits.push({ c: c.i, date: d, time: pick(['09:15:00', '11:59:59', '12:00:00', '15:30:00']), amount: int(1, 40) * 5000 });
    const extra = int(0, 2);
    for (let k = 0; k < extra; k++) {
      const inM = r() < 0.5;
      const date = inM ? addDays(M, int(0, mDaysSoFar - 1)) : addDays(PM, int(0, pmDays - 1));
      deposits.push({ c: c.i, date, time: pick(['08:00:00', '11:30:00', '12:00:00', '13:45:00']), amount: int(1, 20) * 2500 });
    }
  }
  const amt = () => (r() < 0.65 ? 1 : -1) * Number((r() * 30000).toFixed(2)) + (r() < 0.1 ? 0.01 : 0);
  const pmEntries = []; for (let d = 0; d < pmDays; d++) if (r() < 0.55) pmEntries.push({ date: addDays(PM, d), amount: Number(amt().toFixed(2)) });
  const mEntries = []; for (let d = 0; d < mDaysSoFar; d++) if (r() < 0.6) mEntries.push({ date: addDays(M, d), amount: Number(amt().toFixed(2)) });
  // withdrawals at the PM close: only for customers with capital in PM
  const withdrawals = [];
  for (const c of customers) {
    const hasPm = deposits.some((x) => x.c === c.i && effective(x.date, x.time) < M);
    if (hasPm && r() < 0.35) withdrawals.push({ c: c.i, amount: r() < 0.4 ? 9999999 : int(1, 20) * 1000 });
  }
  const emergencies = customers.filter(() => r() < 0.3).map((c) => c.i);
  const afterEntry = r() < 0.5 ? Number(amt().toFixed(2)) : null; // an entry dated after the exits
  const capChange = r() < 0.5 ? { c: int(1, n), pct: pick([4, 7, 10]) } : null;
  return { seed, hidden, share, customers, deposits, pmEntries, mEntries, withdrawals, emergencies, afterEntry, capChange };
}

// ---------- SQL for a scenario ----------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
function sql(s) {
  const L = [];
  L.push('begin;', 'set client_min_messages = warning;');
  L.push(`insert into franchisees (id, name, profit_share_pct) values (${q(P)}, 'Fuzz', ${s.share});`);
  L.push(`insert into franchisee_terms values (${q(P)}, ${s.hidden});`);
  for (const c of s.customers) L.push(`insert into customers (id, franchisee_id, full_name, phone, plan, cap_pct, status) values (${q(c.id)}, ${q(P)}, 'F${c.i}', '96000000${String(c.i).padStart(2, '0')}', '${c.plan}', ${c.capPct}, 'active');`);
  for (const d of s.deposits) L.push(`insert into capital_movements (customer_id, received_at, amount) values (${q(cid(d.c))}, '${d.date} ${d.time}+05:30', ${d.amount});`);
  for (const e of s.pmEntries) L.push(`insert into daily_entries (franchisee_id, trade_date, amount) values (${q(P)}, '${e.date}', ${e.amount});`);
  for (const w of s.withdrawals) L.push(`insert into withdrawal_requests (customer_id, amount) values (${q(cid(w.c))}, ${w.amount});`);
  L.push(`set local role authenticated; set local request.jwt.claims = '{"sub":"${ADMIN}"}';`);
  L.push(`select close_month('${PM}');`);
  L.push('reset role;');
  for (const e of s.mEntries) L.push(`insert into daily_entries (franchisee_id, trade_date, amount) values (${q(P)}, '${e.date}', ${e.amount});`);
  L.push(`set local role authenticated; set local request.jwt.claims = '{"sub":"${ADMIN}"}';`);
  for (const c of s.emergencies) L.push(`select process_emergency_exit(${q(cid(c))}) from customers where id = ${q(cid(c))} and status = 'active';`);
  L.push('reset role;');
  L.push(`select 1 from (select max(trade_date) t from daily_entries where franchisee_id = ${q(P)}) x;`);
  if (s.afterEntry !== null) L.push(`insert into daily_entries (franchisee_id, trade_date, amount) select ${q(P)}, coalesce(max(trade_date) + 1, '${M}'), ${s.afterEntry} from daily_entries where franchisee_id = ${q(P)} and trade_date >= '${M}';`);
  if (s.capChange) L.push(`update customers set cap_pct = ${s.capChange.pct} where id = ${q(cid(s.capChange.c))} and status = 'active';`);
  L.push('set constraints all immediate;');
  L.push(`select json_build_object(
    'cd', (select json_agg(json_build_object('c', customer_id, 'd', trade_date, 'credited', credited, 'cap', cap, 'capital', capital) order by trade_date, customer_id) from customer_days where franchisee_id = ${q(P)}),
    'fd', (select json_agg(json_build_object('d', trade_date, 'net', net, 'to', to_customers, 'over', overflow, 'partner', partner_income, 'exit', exit_share, 'n', customers) order by trade_date) from franchisee_days where franchisee_id = ${q(P)}),
    'st', (select json_agg(json_build_object('c', s.customer_id, 'invested', invested, 'result', result, 'carried_in', carried_in, 'profit', profit_payout, 'w', withdrawal, 'full', full_exit, 'total', payout_total, 'out', carried_out) order by s.customer_id) from settlements s join customers c on c.id = s.customer_id where c.franchisee_id = ${q(P)}),
    'em', (select json_agg(json_build_object('c', x.customer_id, 'through', through, 'capital', capital, 'carried', carried_in, 'result', result, 'payout', payout) order by x.customer_id) from emergency_exits x join customers c on c.id = x.customer_id where c.franchisee_id = ${q(P)}),
    'capital', (select json_agg(json_build_object('c', c.id, 'total', total_capital(c.id), 'm', capital_on(c.id, '${M}'), 'far', capital_on(c.id, '2099-01-01'), 'status', c.status) order by c.id) from customers c where c.franchisee_id = ${q(P)}),
    'books', (select json_agg(b) from check_books() b));`);
  L.push('rollback;');
  return L.join('\n');
}

function runSql(text) {
  const out = execFileSync('docker', ['exec', '-i', 'supabase_db_exit', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'], { input: text, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  const line = out.trim().split('\n').filter((l) => l.startsWith('{')).pop();
  return JSON.parse(line);
}

// ---------- the simulator ----------
function simulate(s) {
  const cs = s.customers.map((c) => ({ ...c, moves: [], status: 'active' }));
  for (const d of s.deposits) cs[d.c - 1].moves.push({ eff: effective(d.date, d.time), amt: B(d.amount * 100) });
  const capOn = (c, day) => c.moves.filter((m) => m.eff <= day).reduce((a, m) => a + m.amt, 0n);
  const totalCap = (c) => c.moves.reduce((a, m) => a + m.amt, 0n);
  const dayCap = (c, pct, day) => {
    const m = monthOf(day), mEnd = nextMonth(m), D = B(daysBetween(m, mEnd));
    let num = capOn(c, m) * D;
    for (const k of c.moves) if (k.eff > m && k.eff <= day) num += k.amt * B(daysBetween(k.eff, mEnd));
    return roundDiv(B(pct) * num, 100n * D);
  };
  const capitalForMonth = (c, m) => { const v = capOn(c, m); if (v !== 0n) return v; const first = c.moves.filter((k) => k.eff > m && k.eff < nextMonth(m)).map((k) => k.eff).sort()[0]; return first ? capOn(c, first) : 0n; };

  // One month of the waterfall for this partner. frozen: {date, covered[]} days up to date kept.
  function month(entries, pcts, eligibleCustomers, startCovered) {
    const days = [], fdays = [];
    const covered = startCovered ? [...startCovered] : cs.map(() => 0n);
    for (const e of entries) {
      const amtP = P2(e.amount);
      const net = amtP > 0n ? roundDiv(amtP * B(100 - s.hidden), 100n) : amtP;
      const w = cs.map((c, i) => (eligibleCustomers.includes(i) ? capOn(c, e.date) : 0n));
      const cap = cs.map((c, i) => dayCap(c, pcts[i], e.date));
      const ok = w.map((x) => x > 0n);
      const got = cs.map(() => 0n);
      const room = (i) => cap[i] - covered[i] - got[i];
      if (net >= 0n) {
        for (;;) {
          const left = net - got.reduce((a, b) => a + b, 0n);
          const open = cs.map((_, i) => i).filter((i) => ok[i] && room(i) > 0n);
          const W = open.reduce((a, i) => a + w[i], 0n);
          if (W === 0n || left <= 0n) break;
          let topped = false;
          for (const i of open) if (left * w[i] >= room(i) * W) { got[i] += room(i); topped = true; }
          if (topped) continue;
          const rem = cs.map(() => -1n);
          for (const i of open) { got[i] += (left * w[i]) / W; rem[i] = (left * w[i]) % W; }
          let cents = net - got.reduce((a, b) => a + b, 0n);
          while (cents > 0n) {
            let p = -1;
            for (let i = 0; i < cs.length; i++) if (rem[i] >= 0n && room(i) >= 1n && (p < 0 || rem[i] > rem[p] || (rem[i] === rem[p] && w[i] > w[p]))) p = i;
            if (p < 0) break;
            got[p] += 1n; rem[p] = -1n; cents -= 1n;
          }
          break;
        }
      } else {
        const W = cs.reduce((a, _, i) => a + (ok[i] ? w[i] : 0n), 0n);
        if (W > 0n) {
          const rem = cs.map(() => -1n);
          for (let i = 0; i < cs.length; i++) if (ok[i]) { got[i] = -((-net * w[i]) / W); rem[i] = (-net * w[i]) % W; }
          let cents = got.reduce((a, b) => a + b, 0n) - net;
          while (cents > 0n) {
            let p = -1;
            for (let i = 0; i < cs.length; i++) if (rem[i] >= 0n && (p < 0 || rem[i] > rem[p] || (rem[i] === rem[p] && w[i] > w[p]))) p = i;
            if (p < 0) break;
            got[p] -= 1n; rem[p] = -1n; cents -= 1n;
          }
        }
      }
      const over = net >= 0n ? net - got.reduce((a, b) => a + b, 0n) : 0n;
      const partner = roundDiv(over * B(s.share), 100n);
      fdays.push({ d: e.date, net, to: got.reduce((a, b) => a + b, 0n), over, partner, exit: over - partner, n: ok.filter(Boolean).length });
      for (let i = 0; i < cs.length; i++) if (ok[i]) { covered[i] += got[i]; days.push({ c: cs[i].id, d: e.date, credited: got[i], cap: cap[i], capital: w[i] }); }
    }
    return { days, fdays, covered };
  }

  const all = cs.map((_, i) => i);
  const pcts0 = cs.map((c) => c.capPct);
  // Previous month, then its close.
  const pm = month(s.pmEntries, pcts0, all);
  const settlements = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const myDays = pm.days.filter((x) => x.c === c.id);
    const invested = capitalForMonth(c, PM);
    if (invested === 0n && myDays.length === 0) continue;
    const result = myDays.reduce((a, x) => a + x.credited, 0n);
    let profit, out;
    if (c.plan === 'fixed') { profit = dayCap(c, c.capPct, addDays(M, -1)); out = 0n; }
    else { profit = result > 0n ? result : 0n; out = result < 0n ? result : 0n; }
    let wv = 0n, full = false;
    const req = s.withdrawals.find((x) => x.c === c.i);
    if (req) {
      const avail0 = capOn(c, M) + out; const avail = avail0 > 0n ? avail0 : 0n;
      const want = B(req.amount * 100);
      wv = want < avail ? want : avail;
      full = wv >= avail;
      if (full) {
        const t = totalCap(c) + out; wv = t > 0n ? t : 0n;
        closeOut(c, M); out = 0n; c.status = 'closed';
      } else if (wv > 0n) c.moves.push({ eff: M, amt: -wv });
    }
    c.carried = out;
    settlements.push({ c: c.id, invested, result, carried_in: 0n, profit, w: wv, full, total: profit + wv, out });
  }
  function closeOut(c, from) {
    const now = capOn(c, from);
    const later = {};
    for (const k of c.moves) if (k.eff > from) later[k.eff] = (later[k.eff] ?? 0n) + k.amt;
    if (now !== 0n) c.moves.push({ eff: from, amt: -now });
    for (const [eff, a] of Object.entries(later)) if (a !== 0n) c.moves.push({ eff, amt: -a });
  }

  // This month: everyone approved and not closed at the PM close takes part (closed ones have no capital anyway).
  const active = all;
  let mres = month(s.mEntries, pcts0, active);
  const through = s.mEntries.filter((e) => e.date <= TODAY).map((e) => e.date).sort().pop() ?? null;
  const emergencies = [];
  const exiting = s.emergencies.map((n) => n - 1).filter((i) => cs[i].status === 'active');
  for (const i of exiting) {
    const c = cs[i];
    const result = mres.days.filter((x) => x.c === c.id && through && x.d <= through).reduce((a, x) => a + x.credited, 0n);
    const carried = c.carried ?? 0n;
    const capital = totalCap(c);
    const v = capital + carried + result;
    emergencies.push({ c: c.id, through, capital, carried, result, payout: c.plan === 'fixed' ? capital : v > 0n ? v : 0n });
    closeOut(c, through ? addDays(through, 1) : M);
    c.status = 'closed';
  }
  // After the exits: days up to `through` stay frozen (if anyone exited); later entries use the final state.
  const pcts = cs.map((c, i) => (s.capChange && s.capChange.c === i + 1 && c.status === 'active' ? s.capChange.pct : c.capPct));
  const lastM = s.mEntries.map((e) => e.date).sort().pop();
  const after = s.afterEntry !== null ? [{ date: lastM ? addDays(lastM, 1) : M, amount: s.afterEntry }] : [];
  const allM = [...s.mEntries, ...after].sort((a, b) => a.date.localeCompare(b.date));
  let days, fdays;
  if (exiting.length && through) {
    const frozenDays = mres.days.filter((x) => x.d <= through), frozenF = mres.fdays.filter((x) => x.d <= through);
    const cov = cs.map((c) => frozenDays.filter((x) => x.c === c.id).reduce((a, x) => a + x.credited, 0n));
    const rest = month(allM.filter((e) => e.date > through), pcts, all, cov);
    days = [...frozenDays, ...rest.days]; fdays = [...frozenF, ...rest.fdays];
  } else {
    const r2 = month(allM, pcts, all);
    days = r2.days; fdays = r2.fdays;
  }
  const capital = cs.map((c) => ({ c: c.id, total: totalCap(c), m: capOn(c, M), far: capOn(c, '2099-01-01'), status: c.status }));
  return { cd: [...pm.days, ...days], fd: [...pm.fdays, ...fdays], st: settlements, em: emergencies, capital };
}

// ---------- compare ----------
const sortCd = (a) => [...a].sort((x, y) => x.d.localeCompare(y.d) || x.c.localeCompare(y.c));
function compare(s, db, sim) {
  const errs = [];
  const eq = (what, a, b) => { if (a !== b) errs.push(`${what}: db ${a} sim ${b}`); };
  const dbCd = sortCd(db.cd ?? []), simCd = sortCd(sim.cd);
  eq('customer-day rows', dbCd.length, simCd.length);
  for (let i = 0; i < Math.min(dbCd.length, simCd.length); i++) {
    const a = dbCd[i], b = simCd[i];
    const k = `${b.d} ${b.c.slice(-2)}`;
    eq(`cd ${k} key`, `${a.d} ${a.c}`, `${b.d} ${b.c}`);
    eq(`cd ${k} credited`, Number(a.credited).toFixed(2), rup(b.credited));
    eq(`cd ${k} cap`, Number(a.cap).toFixed(2), rup(b.cap));
    eq(`cd ${k} capital`, Number(a.capital).toFixed(2), rup(b.capital));
  }
  const dbFd = db.fd ?? [];
  eq('partner-day rows', dbFd.length, sim.fd.length);
  for (let i = 0; i < Math.min(dbFd.length, sim.fd.length); i++) {
    const a = dbFd[i], b = sim.fd[i];
    for (const [k, v] of [['net', b.net], ['to', b.to], ['over', b.over], ['partner', b.partner], ['exit', b.exit]]) eq(`fd ${b.d} ${k}`, Number(a[k]).toFixed(2), rup(v));
    eq(`fd ${b.d} customers`, a.n, b.n);
  }
  const dbSt = db.st ?? [];
  eq('settlement rows', dbSt.length, sim.st.length);
  for (const b of sim.st) {
    const a = dbSt.find((x) => x.c === b.c);
    if (!a) { errs.push(`settlement missing ${b.c}`); continue; }
    for (const k of ['invested', 'result', 'carried_in', 'profit', 'w', 'total', 'out']) eq(`st ${b.c.slice(-2)} ${k}`, Number(a[k]).toFixed(2), rup(b[k]));
    eq(`st ${b.c.slice(-2)} full`, a.full, b.full);
  }
  const dbEm = db.em ?? [];
  eq('emergency rows', dbEm.length, sim.em.length);
  for (const b of sim.em) {
    const a = dbEm.find((x) => x.c === b.c);
    if (!a) { errs.push(`emergency missing ${b.c}`); continue; }
    eq(`em ${b.c.slice(-2)} through`, a.through, b.through);
    for (const k of ['capital', 'carried', 'result', 'payout']) eq(`em ${b.c.slice(-2)} ${k}`, Number(a[k]).toFixed(2), rup(b[k]));
  }
  for (const b of sim.capital) {
    const a = (db.capital ?? []).find((x) => x.c === b.c);
    for (const k of ['total', 'm', 'far']) eq(`capital ${b.c.slice(-2)} ${k}`, Number(a[k]).toFixed(2), rup(b[k]));
    eq(`status ${b.c.slice(-2)}`, a.status, b.status);
  }
  for (const v of db.books ?? []) errs.push(`check_books: ${JSON.stringify(v)}`);
  return errs;
}

let bad = 0, rows = 0;
const t0 = Date.now();
for (let seed = START; seed < START + N; seed++) {
  const s = scenario(seed);
  let db;
  try { db = runSql(sql(s)); } catch (e) { bad++; console.log(`seed ${seed}: SQL error ${String(e.stderr || e.message).split('\n').find((l) => /ERROR/.test(l))}`); continue; }
  const sim = simulate(s);
  const errs = compare(s, db, sim);
  rows += (db.cd ?? []).length + (db.fd ?? []).length + (db.st ?? []).length + (db.em ?? []).length;
  if (errs.length) { bad++; console.log(`seed ${seed}: ${errs.length} mismatches\n  ${errs.slice(0, 8).join('\n  ')}`); }
}
console.log(`\n${N} scenarios (seeds ${START}..${START + N - 1}), ${rows} rows compared, ${bad} failing, ${((Date.now() - t0) / 1000).toFixed(0)}s; month ${M}, previous ${PM}, today ${TODAY}`);
process.exit(bad ? 1 : 0);
