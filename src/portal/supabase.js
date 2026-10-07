import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// PKCE keeps auth redirects in ?code=, so they don't collide with the portal's #/hash routes.
// null when the build has no Supabase settings (see PORTAL.md); the portal then says it isn't set up.
export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;

// The API returns at most 1,000 rows per request; page through so long lists are never silently cut short.
// The first page reports the total, then the rest load in parallel.
// `build` must return a fresh query with a stable order each time it's called; pass the select columns as `columns`.
export async function fetchAll(build, size = 1000) {
  const first = await build({ count: 'exact' }).range(0, size - 1);
  if (first.error || first.count == null || first.count <= size) return first;
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(first.count / size) - 1 }, (_, i) => build().range((i + 1) * size, (i + 2) * size - 1)),
  );
  const failed = rest.find((r) => r.error);
  return failed ?? { data: first.data.concat(...rest.map((r) => r.data)), error: null };
}

// KYC files go through the kyc-file server function, which encrypts on upload and decrypts for permitted viewers.
const kycUrl = `${url}/functions/v1/kyc-file`;
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return { apikey: key, Authorization: `Bearer ${data.session?.access_token}` };
}
export async function kycUpload(customerId, kind, blob) {
  const r = await fetch(`${kycUrl}?customer=${customerId}&kind=${kind}`, {
    method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': blob.type }, body: blob,
  });
  if (r.ok) return { error: null };
  const body = await r.json().catch(() => ({}));
  return { error: { message: body.error ?? `Upload failed (${r.status})` } };
}
// A temporary in-browser link to the decrypted file; revoke it with URL.revokeObjectURL when done.
export async function kycObjectUrl(path) {
  const r = await fetch(`${kycUrl}?path=${encodeURIComponent(path)}`, { headers: await authHeaders() });
  return r.ok ? URL.createObjectURL(await r.blob()) : null;
}
