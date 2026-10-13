// Login management. The browser can't do these itself because they need the service-role key.
// Admin only, except customer_login, which staff and the customer's own partner may also use.
//   { action: 'create', email, password, full_name, role, franchisee_id?, office? }  → office: staff tied to one office's requests
//   { action: 'set_password', user_id, password }      → the admin shares the new temporary password
//   { action: 'delete_login', user_id }
//   { action: 'delete_partner', franchisee_id }       → only a partner with no customers and no results
//   { action: 'customer_login', customer_id, password } → creates the customer's login, or resets its password.
//     Customers sign in with their 10-digit mobile number, stored as the email <mobile>@customer.exit.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // Acting as the caller: row-level security and the activity log see who did it.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user: me } } = await caller.auth.getUser();
  const { data: role } = await caller.rpc('my_role');
  const body = await req.json().catch(() => ({}));
  const customerAction = body.action === 'customer_login' && ['admin', 'employee', 'franchisee'].includes(role);
  if (!me || (role !== 'admin' && !customerAction)) return json({ error: 'Only an admin can manage logins.' }, 403);

  const passwordOk = (p: unknown) => typeof p === 'string' && p.length >= 8;
  // Every password handed out here is temporary: the portal asks for a new one at the next login.
  const temp = { app_metadata: { must_change_password: true } };

  // Removes a login: the profile first as the caller (so the activity log records who), then the account.
  async function removeLogin(userId: string) {
    const { data: removed, error } = await caller.from('profiles').delete().eq('id', userId).select('id');
    if (error) return error.message;
    if (!removed?.length) return 'Login not found.';
    const del = await admin.auth.admin.deleteUser(userId);
    return del.error?.message ?? null;
  }

  // An account with this email that has no profile, i.e. no portal access.
  async function strayLogin(email: string) {
    // ponytail: scans up to 1000 accounts; page through listUsers if Exit ever has more.
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    const { data: profile } = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle();
    return profile ? null : user.id;
  }

  switch (body.action) {
    case 'create': {
      const { email, password, full_name, role: newRole, franchisee_id, office } = body;
      if (!/^\S+@\S+\.\S+$/.test(email ?? '')) return json({ error: 'Enter a valid email.' }, 400);
      if (!passwordOk(password)) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if (!(full_name ?? '').trim()) return json({ error: 'Enter a name.' }, 400);
      if (!['admin', 'employee', 'franchisee'].includes(newRole)) return json({ error: 'Choose a role.' }, 400);
      if ((newRole === 'franchisee') !== Boolean(franchisee_id)) return json({ error: 'Partner logins need a partner; staff logins must not have one.' }, 400);
      let { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, ...temp });
      if (error && /already/i.test(error.message)) {
        // A login half-removed earlier (account left, profile gone) is invisible on the Partners page: take it over.
        const stray = await strayLogin(email);
        if (!stray) return json({ error: 'A login with this email already exists. Find it on the Partners page.' }, 400);
        ({ data, error } = await admin.auth.admin.updateUserById(stray, { password, email_confirm: true, ...temp }));
      }
      if (error) return json({ error: error.message }, 400);
      // As the caller, so the activity log shows which admin added it.
      const { error: profileError } = await caller.from('profiles').insert({
        id: data.user.id, email, full_name: full_name.trim(), role: newRole, franchisee_id: franchisee_id ?? null,
        office: newRole === 'employee' ? office || null : null, // the database checks it's a real office
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id); // don't leave a login without a profile
        return json({ error: profileError.message }, 400);
      }
      return json({ id: data.user.id });
    }

    case 'set_password': {
      const { user_id, password } = body;
      if (!passwordOk(password)) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const { data: target } = await caller.from('profiles').select('id, full_name, email').eq('id', user_id).maybeSingle();
      if (!target) return json({ error: 'Login not found.' }, 404);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password, ...temp });
      if (error) return json({ error: error.message }, 400);
      await admin.from('audit_log').insert({ actor: me.id, table_name: 'profiles', op: 'PASSWORD', new: target });
      return json({ ok: true });
    }

    case 'delete_login': {
      const { user_id } = body;
      if (user_id === me.id) return json({ error: "You can't remove your own login." }, 400);
      const { data: target } = await caller.from('profiles').select('role').eq('id', user_id).maybeSingle();
      if (!target) return json({ error: 'Login not found.' }, 404);
      if (target.role === 'admin') {
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
        if ((count ?? 0) <= 1) return json({ error: "This is the last admin login, so it can't be removed." }, 400);
      }
      const problem = await removeLogin(user_id);
      return problem ? json({ error: problem }, 400) : json({ ok: true });
    }

    case 'delete_partner': {
      const { franchisee_id } = body;
      const { data: deletable } = await caller.rpc('partner_deletable', { p_franchisee: franchisee_id });
      if (!deletable) return json({ error: "This partner has customers or results, so it can't be deleted. Mark it inactive instead." }, 400);
      const { data: logins } = await admin.from('profiles').select('id').eq('franchisee_id', franchisee_id);
      for (const l of logins ?? []) {
        const problem = await removeLogin(l.id);
        if (problem) return json({ error: problem }, 400);
      }
      const terms = await caller.from('franchisee_terms').delete().eq('franchisee_id', franchisee_id);
      const partner = terms.error ? terms : await caller.from('franchisees').delete().eq('id', franchisee_id).select('id');
      if (partner.error) return json({ error: partner.error.message }, 400);
      return json({ ok: true });
    }

    case 'customer_login': {
      const { customer_id, password } = body;
      if (!passwordOk(password)) return json({ error: 'Password must be at least 8 characters.' }, 400);
      // Row-level security: the caller only gets the customer back if they may see them.
      const { data: customer } = await caller.from('customers').select('phone, status').eq('id', customer_id).maybeSingle();
      if (!customer) return json({ error: 'Customer not found.' }, 404);
      const { data: existing } = await caller.rpc('customer_login_id', { p_customer: customer_id });
      if (existing) {
        const { error } = await admin.auth.admin.updateUserById(existing, { password, ...temp });
        if (error) return json({ error: error.message }, 400);
        await admin.from('audit_log').insert({ actor: me.id, table_name: 'profiles', op: 'PASSWORD', new: { id: existing, customer_id } });
        return json({ id: existing, reset: true });
      }
      if (customer.status !== 'active') return json({ error: 'Logins are for approved customers only.' }, 400);
      const mobile = customer.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      if (!/^[6-9]\d{9}$/.test(mobile)) return json({ error: "The customer's mobile number isn't a valid 10-digit Indian number. Ask Exit staff to correct it." }, 400);
      const email = `${mobile}@customer.exit`;
      let { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, ...temp });
      if (error && /already/i.test(error.message)) {
        const stray = await strayLogin(email);
        if (!stray) return json({ error: 'Another login already uses this mobile number.' }, 400);
        ({ data, error } = await admin.auth.admin.updateUserById(stray, { password, email_confirm: true, ...temp }));
      }
      if (error) return json({ error: error.message }, 400);
      const { error: linkError } = await caller.rpc('link_customer_login', { p_user: data.user.id, p_customer: customer_id });
      if (linkError) {
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: linkError.message }, 400);
      }
      return json({ id: data.user.id, mobile });
    }

    default:
      return json({ error: 'Unknown action.' }, 400);
  }
});
