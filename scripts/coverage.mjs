// Coverage of the database code (all business logic lives there).
//   PL/pgSQL functions and triggers: statement and branch coverage from the plpgsql_check profiler.
//   SQL functions: called at least once (pg_stat_user_functions).
// It turns the profiler on for the local database, runs the pgTAP suite and a fuzz batch, then reports.
// Local stack only. Usage: node scripts/coverage.mjs [fuzzScenarios=150]   |   node scripts/coverage.mjs --report
import { execFileSync } from 'node:child_process';

const REPORT_ONLY = process.argv[2] === '--report'; // read what earlier runs collected
const FUZZ = REPORT_ONLY ? 0 : Number(process.argv[2] ?? 150);
const psql = (sql) => execFileSync('docker', ['exec', '-i', 'supabase_db_exit', 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-tA', '-F', '\t', '-v', 'ON_ERROR_STOP=1'], { input: sql, maxBuffer: 64 << 20 }).toString().trim();
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true, maxBuffer: 64 << 20 }).toString();

if (!REPORT_ONLY) {
  psql(`create extension if not exists plpgsql_check with schema extensions;
    alter database postgres set plpgsql_check.profiler = on;
    alter database postgres set track_functions = 'all';
    select extensions.plpgsql_profiler_reset_all();
    select pg_stat_reset();`);
  const tests = run('npx', ['supabase', 'test', 'db']);
  console.log(tests.split('\n').filter((l) => /Result|Tests=/.test(l)).join('\n'));
  if (FUZZ) console.log(run('node', ['scripts/fuzz-payouts.mjs', String(FUZZ), '5001']).trim().split('\n').pop());
}

const rows = psql(`
select p.proname,
       count(*) filter (where s.stmtname <> 'statement block') as total,
       count(*) filter (where s.stmtname <> 'statement block' and s.exec_stmts > 0) as hit,
       coalesce(extensions.plpgsql_coverage_branches(p.oid), 1) as branches
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
cross join lateral extensions.plpgsql_profiler_function_statements_tb(p.oid) s
where n.nspname = 'public' and l.lanname = 'plpgsql'
group by p.oid, p.proname;`).split('\n').filter(Boolean).map((l) => l.split('\t'))
  .sort((a, b) => Number(a[2]) / Number(a[1] || 1) - Number(b[2]) / Number(b[1] || 1) || a[0].localeCompare(b[0]));
let total = 0, hit = 0;
console.log('\nPL/pgSQL functions (statements hit/total, branches):');
for (const [name, t, h, b] of rows) {
  total += Number(t); hit += Number(h);
  const pct = Number(t) ? (100 * Number(h)) / Number(t) : 100;
  console.log(`  ${pct.toFixed(1).padStart(5)}%  ${h}/${t}  branches ${(100 * Number(b)).toFixed(0)}%  ${name}`);
}
const sqlFns = psql(`
select p.proname, coalesce(f.calls, 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
left join pg_stat_user_functions f on f.funcid = p.oid
where n.nspname = 'public' and l.lanname = 'sql'
order by 2, 1;`).split('\n').filter(Boolean).map((l) => l.split('\t'));
const uncalled = sqlFns.filter(([, c]) => Number(c) === 0).map(([n]) => n);
console.log(`\nSQL functions called: ${sqlFns.length - uncalled.length}/${sqlFns.length}${uncalled.length ? ` (not seen: ${uncalled.join(', ')})` : ''}`);
console.log(`\nPL/pgSQL statement coverage: ${hit}/${total} = ${((100 * hit) / total).toFixed(1)}%`);

if (!REPORT_ONLY) psql(`alter database postgres reset plpgsql_check.profiler; alter database postgres reset track_functions;`);
