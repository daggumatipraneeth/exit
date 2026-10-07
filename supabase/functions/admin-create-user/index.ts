// Admin-only: create a login (partner or staff) with a temporary password.
// The browser can't do this itself because it needs the service-role key.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: role } = await caller.rpc('my_role');
  if (role !== 'admin') return json({ error: 'Only an admin can create logins.' }, 403);

  const { email, password, full_name, role: newRole, franchisee_id } = await req.json();
  if (!/^\S+@\S+\.\S+$/.test(email ?? '')) return json({ error: 'Enter a valid email.' }, 400);
  if ((password ?? '').length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
  if (!(full_name ?? '').trim()) return json({ error: 'Enter a name.' }, 400);
  if (!['admin', 'employee', 'franchisee'].includes(newRole)) return json({ error: 'Choose a role.' }, 400);
  if ((newRole === 'franchisee') !== Boolean(franchisee_id)) return json({ error: 'Partner logins need a partner; staff logins must not have one.' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return json({ error: error.message }, 400);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id, email, full_name: full_name.trim(), role: newRole, franchisee_id: franchisee_id ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id); // don't leave a login without a profile
    return json({ error: profileError.message }, 400);
  }
  return json({ id: data.user.id });
});
