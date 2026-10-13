// Fuzz test for the money: random multi-month, multi-partner scenarios run through the real SQL (in a rolled-back
// transaction), checked row by row against an independent simulator written from the rules in PORTAL.md, in exact
// integer paise (BigInt), plus check_books() after every scenario.
// Each scenario: 2-3 past months closed in order (terms changing, withdrawals, carried losses, full exits, sometimes a
// reopen + re-close), then the current month with emergency exits, entries after them and a cap % change.
// Needs the local stack (npm run db:start; container supabase_db_exit) and the seed's admin login.
// Usage: node scripts/fuzz-payouts.mjs [scenarios=200] [startSeed=1]   (a failing seed can be replayed alone)
import { execFileSync } from 'node:child_process';

const N = Number(process.argv[2] ?? 200), START = Number(process.argv[3] ?? 1);
const ADMIN = '00000000-0000-0000-0000-00000000000a';
const pid = (p) => `f7000000-0000-0000-0000-${String(p).padStart(12, '0')}`;
const cid = (i) => `c7000000-0000-0000-0000-${String(i).padStart(12, '0')}`;

// ---------- dates (IST calendar dates 'YYYY-MM-DD') ----------
const TODAY = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const monthOf = (d) => `${d.slice(0, 7)}-01`;
const addMonths = (m, n) => { const x = new Date(`${m}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400e3);
const M = monthOf(TODAY);
// Money counts from the day after the IST day it's received, whatever the time.
const effective = (date) => addDays(date, 1);

// ---------- exact money ----------
const B = BigInt;
const rup = (p) => (Number(p) / 100).toFixed(2);
const P2 = (rupees) => B(Math.round(Number(rupees) * 100));
const roundDiv = (num, den) => { const s = num < 0n ? -1n : 1n; const a = num < 0n ? -num : num; return s * ((2n * a + den) / (2n * den)); };

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function scenario(seed) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const K = int(2, 3);                                   // closed months before the current one
  const months = Array.from({ length: K }, (_, k) => addMonths(M, k - K)); // oldest first
  const first = months[0];
  const partners = Array.from({ length: int(1, 3) }, (_, i) => ({ p: i + 1, id: pid(i + 1) }));
  const customers = [];
  for (const pt of partners) for (let k = 0, n = int(1, 4); k < n; k++) {
    const i = customers.length + 1;
    customers.push({ i, id: cid(i), p: pt.p, plan: r() < 0.25 ? 'fixed' : 'variable', capPct: pick([6, 6, 5, 8]) });
  }
  // terms per partner per month (index K = the current month)
  const terms = partners.map(() => {
    const t = []; let h = pick([0, 10, 20, 25]), s = pick([50, 60, 70, 80]);
    for (let k = 0; k <= K; k++) { if (r() < 0.3) { h = pick([0, 10, 20, 25]); s = pick([50, 60, 70, 80]); } t.push({ h, s }); }
    return t;
  });
  const span = daysBetween(first, TODAY) + 1;
  const deposits = [];
  for (const c of customers) {
    deposits.push({ c: c.i, date: addDays(first, int(-1, span - 1)), time: pick(['00:00:00', '09:15:00', '12:00:00', '23:59:59']), amount: int(1, 40) * 5000 });
    for (let k = 0, x = int(0, 3); k < x; k++) deposits.push({ c: c.i, date: addDays(first, int(0, span - 1)), time: pick(['00:00:01', '11:30:00', '18:29:59', '23:59:59']), amount: int(1, 20) * 2500 });
  }
  const amt = () => Number(((r() < 0.62 ? 1 : -1) * r() * 30000).toFixed(2)) || 0.01;
  const entries = partners.map(() => {
    const e = [];
    for (let k = 0; k <= K; k++) {
      const m = k < K ? months[k] : M, end = k < K ? addMonths(m, 1) : addDays(TODAY, 1);
      for (let d = m; d < end; d = addDays(d, 1)) if (r() < 0.5) e.push({ date: d, amount: amt(), k });
    }
    return e;
  });
  const withdrawals = months.map(() => customers.filter(() => r() < 0.25).map((c) => ({ c: c.i, amount: r() < 0.35 ? 9999999 : int(1, 30) * 1000 })));
  const reopen = r() < 0.3;
  const emergencies = customers.filter(() => r() < 0.3).map((c) => c.i);
  const after = partners.map(() => (r() < 0.5 ? amt() : null));
  const capChange = r() < 0.5 ? { c: int(1, customers.length), pct: pick([4, 7, 10]) } : null;
  return { seed, K, months, partners, customers, terms, deposits, entries, withdrawals, reopen, emergencies, after, capChange };
}

// ---------- SQL ----------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const asAdmin = `set local role authenticated; set local request.jwt.claims = '{"sub":"${ADMIN}"}';`;
function sql(s) {
  const L = ['begin;', 'set client_min_messages = warning;'];
  const setTerms = (k) => s.partners.forEach((pt, j) => {
    const t = s.terms[j][k];
    L.push(`update franchisees set profit_share_pct = ${t.s} where id = ${q(pt.id)};`, `update franchisee_terms set hidden_charge_pct = ${t.h} where franchisee_id = ${q(pt.id)};`);
  });
  for (const pt of s.partners) {
    L.push(`insert into franchisees (id, name, profit_share_pct) values (${q(pt.id)}, 'Fuzz ${pt.p}', 70);`, `insert into franchisee_terms values (${q(pt.id)}, 0);`);
  }
  for (const c of s.customers) L.push(`insert into customers (id, franchisee_id, full_name, phone, plan, cap_pct, status) values (${q(c.id)}, ${q(pid(c.p))}, 'F${c.i}', '960000${String(c.i).padStart(4, '0')}', '${c.plan}', ${c.capPct}, 'active');`);
  L.push(`insert into agreements (customer_id, template_version, signed_at) select id, 1, now() from customers where full_name ~ '^F[0-9]+$' and franchisee_id::text like 'f7%';`);
  for (const d of s.deposits) L.push(`insert into capital_movements (customer_id, received_at, amount) values (${q(cid(d.c))}, '${d.date} ${d.time}+05:30', ${d.amount});`);
  const entriesOf = (k) => s.partners.forEach((pt, j) => s.entries[j].filter((e) => e.k === k).forEach((e) =>
    L.push(`insert into daily_entries (franchisee_id, trade_date, amount) values (${q(pt.id)}, '${e.date}', ${e.amount});`)));
  for (let k = 0; k < s.K; k++) {
    setTerms(k);
    entriesOf(k);
    for (const w of s.withdrawals[k]) L.push(`insert into withdrawal_requests (customer_id, amount) select id, ${w.amount} from customers where id = ${q(cid(w.c))} and status = 'active' and not exists (select 1 from withdrawal_requests where customer_id = ${q(cid(w.c))} and status = 'open');`);
    L.push(asAdmin, `select close_month('${s.months[k]}');`, 'reset role;');
  }
  if (s.reopen) L.push(asAdmin, `select reopen_month('${s.months[s.K - 1]}');`, `select close_month('${s.months[s.K - 1]}');`, 'reset role;');
  setTerms(s.K);
  entriesOf(s.K);
  L.push(asAdmin);
  for (const c of s.emergencies) L.push(`select process_emergency_exit(id) from customers where id = ${q(cid(c))} and status = 'active';`);
  L.push('reset role;');
  s.partners.forEach((pt, j) => {
    if (s.after[j] !== null) L.push(`insert into daily_entries (franchisee_id, trade_date, amount) select ${q(pt.id)}, coalesce(max(trade_date) + 1, '${M}'), ${s.after[j]} from daily_entries where franchisee_id = ${q(pt.id)} and trade_date >= '${M}';`);
  });
  if (s.capChange) L.push(`update customers set cap_pct = ${s.capChange.pct} where id = ${q(cid(s.capChange.c))} and status = 'active';`);
  L.push('set constraints all immediate;');
  const mine = `(select id from franchisees where name like 'Fuzz %')`;
  L.push(`select json_build_object(
    'cd', (select json_agg(json_build_object('c', customer_id, 'd', trade_date, 'credited', credited, 'cap', cap, 'capital', capital) order by trade_date, customer_id) from customer_days where franchisee_id in ${mine}),
    'fd', (select json_agg(json_build_object('f', franchisee_id, 'd', trade_date, 'net', net, 'to', to_customers, 'over', overflow, 'partner', partner_income, 'exit', exit_share, 'n', customers) order by franchisee_id, trade_date) from franchisee_days where franchisee_id in ${mine}),
    'st', (select json_agg(json_build_object('c', s.customer_id, 'm', s.month, 'invested', invested, 'result', result, 'carried_in', carried_in, 'profit', profit_payout, 'w', withdrawal, 'full', full_exit, 'total', payout_total, 'out', carried_out) order by s.month, s.customer_id) from settlements s join customers c on c.id = s.customer_id where c.franchisee_id in ${mine}),
    'em', (select json_agg(json_build_object('c', x.customer_id, 'through', through, 'capital', capital, 'carried', carried_in, 'result', result, 'payout', payout) order by x.customer_id) from emergency_exits x join customers c on c.id = x.customer_id where c.franchisee_id in ${mine}),
    'capital', (select json_agg(json_build_object('c', c.id, 'total', total_capital(c.id), 'm', capital_on(c.id, '${M}'), 'far', capital_on(c.id, '2099-01-01'), 'status', c.status) order by c.id) from customers c where c.franchisee_id in ${mine}),
    'books', (select json_agg(b) from check_books() b));`, 'rollback;');
  return L.join('\n');
}
function runSql(text) {
  const out = execFileSync('docker', ['exec', '-i', 'supabase_db_exit', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'], { input: text, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).toString();
  return JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{')).pop());
}

// ---------- the simulator ----------
function simulate(s) {
  const cs = s.customers.map((c) => ({ ...c, moves: [], status: 'active', carried: 0n, open: null, pct: c.capPct }));
  for (const d of s.deposits) cs[d.c - 1].moves.push({ eff: effective(d.date), amt: B(d.amount * 100) });
  const capOn = (c, day) => c.moves.filter((m) => m.eff <= day).reduce((a, m) => a + m.amt, 0n);
  const totalCap = (c) => c.moves.reduce((a, m) => a + m.amt, 0n);
  const dayCap = (c, pct, day) => {
    const m = monthOf(day), mEnd = addMonths(m, 1), D = B(daysBetween(m, mEnd));
    let num = capOn(c, m) * D;
    for (const k of c.moves) if (k.eff > m && k.eff <= day) num += k.amt * B(daysBetween(k.eff, mEnd));
    return roundDiv(B(pct) * num, 100n * D);
  };
  const capitalForMonth = (c, m) => { const v = capOn(c, m); if (v !== 0n) return v; const f = c.moves.filter((k) => k.eff > m && k.eff < addMonths(m, 1)).map((k) => k.eff).sort()[0]; return f ? capOn(c, f) : 0n; };
  const closeOut = (c, from) => {
    const now = capOn(c, from), later = {};
    for (const k of c.moves) if (k.eff > from) later[k.eff] = (later[k.eff] ?? 0n) + k.amt;
    if (now !== 0n) c.moves.push({ eff: from, amt: -now, tag: 'close' });
    for (const [eff, a] of Object.entries(later)) if (a !== 0n) c.moves.push({ eff, amt: -a, tag: 'close' });
  };

  // One partner, a run of entries in one month; startCovered: bucket levels carried in from frozen days.
  function run(members, entries, term, startCovered) {
    const days = [], fdays = [];
    const covered = startCovered ? [...startCovered] : members.map(() => 0n);
    for (const e of entries) {
      const amtP = P2(e.amount);
      const net = amtP > 0n ? roundDiv(amtP * B(100 - term.h), 100n) : amtP;
      const w = members.map((c) => capOn(c, e.date));
      const cap = members.map((c) => dayCap(c, c.pct, e.date));
      const ok = w.map((x) => x > 0n);
      const got = members.map(() => 0n);
      const room = (i) => cap[i] - covered[i] - got[i];
      const pick = (rem, cond) => { let p = -1; for (let i = 0; i < members.length; i++) if (rem[i] >= 0n && cond(i) && (p < 0 || rem[i] > rem[p] || (rem[i] === rem[p] && w[i] > w[p]))) p = i; return p; };
      if (net >= 0n) {
        for (;;) {
          const left = net - got.reduce((a, b) => a + b, 0n);
          const open = members.map((_, i) => i).filter((i) => ok[i] && room(i) > 0n);
          const W = open.reduce((a, i) => a + w[i], 0n);
          if (W === 0n || left <= 0n) break;
          let topped = false;
          for (const i of open) if (left * w[i] >= room(i) * W) { got[i] += room(i); topped = true; }
          if (topped) continue;
          const rem = members.map(() => -1n);
          for (const i of open) { got[i] += (left * w[i]) / W; rem[i] = (left * w[i]) % W; }
          let cents = net - got.reduce((a, b) => a + b, 0n);
          while (cents > 0n) { const p = pick(rem, (i) => room(i) >= 1n); if (p < 0) break; got[p] += 1n; rem[p] = -1n; cents -= 1n; }
          break;
        }
      } else {
        const W = members.reduce((a, _, i) => a + (ok[i] ? w[i] : 0n), 0n);
        if (W > 0n) {
          const rem = members.map(() => -1n);
          for (let i = 0; i < members.length; i++) if (ok[i]) { got[i] = -((-net * w[i]) / W); rem[i] = (-net * w[i]) % W; }
          let cents = got.reduce((a, b) => a + b, 0n) - net;
          while (cents > 0n) { const p = pick(rem, () => true); if (p < 0) break; got[p] -= 1n; rem[p] = -1n; cents -= 1n; }
        }
      }
      const over = net >= 0n ? net - got.reduce((a, b) => a + b, 0n) : 0n;
      const partner = roundDiv(over * B(term.s), 100n);
      fdays.push({ d: e.date, net, to: got.reduce((a, b) => a + b, 0n), over, partner, exit: over - partner, n: ok.filter(Boolean).length });
      members.forEach((c, i) => { if (ok[i]) { covered[i] += got[i]; days.push({ c: c.id, d: e.date, credited: got[i], cap: cap[i], capital: w[i] }); } });
    }
    return { days, fdays };
  }

  const byPartner = s.partners.map((pt) => cs.filter((c) => c.p === pt.p));
  const out = { cd: [], fd: [], st: [], em: [] };
  const monthDays = {}; // `${p}|${m}` → result of run()

  const closeMonth = (k, m) => {
    for (let j = 0; j < s.partners.length; j++) {
      const res = monthDays[`${j}|${m}`];
      for (const c of byPartner[j]) {
        const myDays = res.days.filter((x) => x.c === c.id);
        const invested = capitalForMonth(c, m);
        if (!(c.status === 'active' || myDays.length) || (invested === 0n && myDays.length === 0)) continue;
        const result = myDays.reduce((a, x) => a + x.credited, 0n);
        let profit, o;
        const carriedIn = c.carried;
        if (c.plan === 'fixed') { profit = dayCap(c, c.pct, addDays(addMonths(m, 1), -1)); o = 0n; }
        else { const v = carriedIn + result; profit = v > 0n ? v : 0n; o = v < 0n ? v : 0n; }
        let wv = 0n, full = false;
        if (c.open !== null) {
          const nxt = addMonths(m, 1);
          const a0 = capOn(c, nxt) + o, avail = a0 > 0n ? a0 : 0n;
          wv = c.open < avail ? c.open : avail; full = wv >= avail;
          if (full) { const t = totalCap(c) + o; wv = t > 0n ? t : 0n; closeOut(c, nxt); o = 0n; c.status = 'closed'; }
          else if (wv > 0n) c.moves.push({ eff: nxt, amt: -wv, tag: 'close' });
          c.open = null;
        }
        c.carried = o;
        out.st.push({ c: c.id, m, invested, result, carried_in: carriedIn, profit, w: wv, full, total: profit + wv, out: o });
      }
    }
  };

  for (let k = 0; k < s.K; k++) {
    const m = s.months[k];
    for (let j = 0; j < s.partners.length; j++) monthDays[`${j}|${m}`] = run(byPartner[j], s.entries[j].filter((e) => e.k === k), s.terms[j][k]);
    for (const w of s.withdrawals[k]) { const c = cs[w.c - 1]; if (c.status === 'active' && c.open === null) c.open = B(w.amount * 100); }
    closeMonth(k, m);
  }
  // (a reopen + re-close of the last month must change nothing, so the simulator does nothing for it)
  for (let k = 0; k < s.K; k++) for (let j = 0; j < s.partners.length; j++) {
    const r = monthDays[`${j}|${s.months[k]}`]; out.cd.push(...r.days); out.fd.push(...r.fdays.map((x) => ({ ...x, f: pid(j + 1) })));
  }

  // The current month: run, exits (per partner), then entries after them and the cap change.
  for (let j = 0; j < s.partners.length; j++) {
    const members = byPartner[j], term = s.terms[j][s.K];
    const mEntries = s.entries[j].filter((e) => e.k === s.K);
    const before = run(members, mEntries, term);
    const through = mEntries.map((e) => e.date).sort().pop() ?? null;
    const exiting = members.filter((c) => s.emergencies.includes(c.i) && c.status === 'active');
    for (const c of exiting) {
      const result = before.days.filter((x) => x.c === c.id && through && x.d <= through).reduce((a, x) => a + x.credited, 0n);
      const capital = totalCap(c), v = capital + c.carried + result;
      out.em.push({ c: c.id, through, capital, carried: c.carried, result, payout: c.plan === 'fixed' ? capital : v > 0n ? v : 0n });
      closeOut(c, through ? addDays(through, 1) : M);
      c.status = 'closed';
    }
    if (s.capChange) { const c = cs[s.capChange.c - 1]; if (c.p === j + 1 && c.status === 'active') c.pct = s.capChange.pct; }
    const afterEntry = s.after[j] !== null ? [{ date: through ? addDays(through, 1) : M, amount: s.after[j] }] : [];
    const all = [...mEntries, ...afterEntry];
    let days, fdays;
    if (exiting.length && through) {
      const fd = before.days.filter((x) => x.d <= through), ff = before.fdays.filter((x) => x.d <= through);
      const cov = members.map((c) => fd.filter((x) => x.c === c.id).reduce((a, x) => a + x.credited, 0n));
      const rest = run(members, all.filter((e) => e.date > through), term, cov);
      days = [...fd, ...rest.days]; fdays = [...ff, ...rest.fdays];
    } else ({ days, fdays } = run(members, all, term));
    out.cd.push(...days); out.fd.push(...fdays.map((x) => ({ ...x, f: pid(j + 1) })));
  }
  out.capital = cs.map((c) => ({ c: c.id, total: totalCap(c), m: capOn(c, M), far: capOn(c, '2099-01-01'), status: c.status }));
  return out;
}

// ---------- compare ----------
function compare(db, sim) {
  const errs = [];
  const eq = (what, a, b) => { if (a !== b) errs.push(`${what}: db ${a} sim ${b}`); };
  const money = (what, a, b) => eq(what, Number(a).toFixed(2), rup(b));
  const cdKey = (x) => `${x.d} ${x.c}`;
  const dbCd = [...(db.cd ?? [])].sort((a, b) => cdKey(a).localeCompare(cdKey(b)));
  const simCd = [...sim.cd].sort((a, b) => cdKey(a).localeCompare(cdKey(b)));
  eq('customer-day rows', dbCd.length, simCd.length);
  for (let i = 0; i < Math.min(dbCd.length, simCd.length); i++) {
    const a = dbCd[i], b = simCd[i], k = `${b.d} c${b.c.slice(-2)}`;
    eq(`cd ${k} key`, cdKey(a), cdKey(b));
    money(`cd ${k} credited`, a.credited, b.credited); money(`cd ${k} cap`, a.cap, b.cap); money(`cd ${k} capital`, a.capital, b.capital);
  }
  const fdKey = (x) => `${x.f} ${x.d}`;
  const dbFd = [...(db.fd ?? [])].sort((a, b) => fdKey(a).localeCompare(fdKey(b)));
  const simFd = [...sim.fd].sort((a, b) => fdKey(a).localeCompare(fdKey(b)));
  eq('partner-day rows', dbFd.length, simFd.length);
  for (let i = 0; i < Math.min(dbFd.length, simFd.length); i++) {
    const a = dbFd[i], b = simFd[i], k = `p${b.f.slice(-1)} ${b.d}`;
    eq(`fd ${k} key`, fdKey(a), fdKey(b));
    for (const f of ['net', 'to', 'over', 'partner', 'exit']) money(`fd ${k} ${f}`, a[f], b[f]);
    eq(`fd ${k} customers`, a.n, b.n);
  }
  const dbSt = db.st ?? [];
  eq('settlement rows', dbSt.length, sim.st.length);
  for (const b of sim.st) {
    const a = dbSt.find((x) => x.c === b.c && x.m === b.m);
    if (!a) { errs.push(`settlement missing ${b.m} c${b.c.slice(-2)}`); continue; }
    for (const f of ['invested', 'result', 'carried_in', 'profit', 'w', 'total', 'out']) money(`st ${b.m} c${b.c.slice(-2)} ${f}`, a[f], b[f]);
    eq(`st ${b.m} c${b.c.slice(-2)} full`, a.full, b.full);
  }
  const dbEm = db.em ?? [];
  eq('emergency rows', dbEm.length, sim.em.length);
  for (const b of sim.em) {
    const a = dbEm.find((x) => x.c === b.c);
    if (!a) { errs.push(`emergency missing c${b.c.slice(-2)}`); continue; }
    eq(`em c${b.c.slice(-2)} through`, a.through, b.through);
    for (const f of ['capital', 'carried', 'result', 'payout']) money(`em c${b.c.slice(-2)} ${f}`, a[f], b[f]);
  }
  for (const b of sim.capital) {
    const a = (db.capital ?? []).find((x) => x.c === b.c);
    for (const f of ['total', 'm', 'far']) money(`capital c${b.c.slice(-2)} ${f}`, a[f], b[f]);
    eq(`status c${b.c.slice(-2)}`, a.status, b.status);
  }
  for (const v of db.books ?? []) errs.push(`check_books: ${JSON.stringify(v)}`);
  return errs;
}

let bad = 0, rows = 0, settlements = 0, exits = 0;
const t0 = Date.now();
for (let seed = START; seed < START + N; seed++) {
  const s = scenario(seed);
  let db;
  try { db = runSql(sql(s)); } catch (e) { bad++; console.log(`seed ${seed}: SQL error ${String(e.stderr || e.message).split('\n').find((l) => /ERROR/.test(l))}`); continue; }
  const errs = compare(db, simulate(s));
  rows += (db.cd ?? []).length + (db.fd ?? []).length + (db.st ?? []).length + (db.em ?? []).length;
  settlements += (db.st ?? []).length; exits += (db.em ?? []).length;
  if (errs.length) { bad++; console.log(`seed ${seed}: ${errs.length} mismatches\n  ${errs.slice(0, 8).join('\n  ')}`); }
}
console.log(`\n${N} scenarios (seeds ${START}..${START + N - 1}): ${rows} rows compared (${settlements} settlements, ${exits} emergency exits), ${bad} failing, ${((Date.now() - t0) / 1000).toFixed(0)}s; current month ${M}, today ${TODAY}`);
process.exit(bad ? 1 : 0);
