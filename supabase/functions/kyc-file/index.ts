// KYC files are encrypted here before they reach storage, and decrypted here only for people allowed to see
// that customer. Storage (and its backups) only ever hold ciphertext; the key stays in the database's Vault.
//   POST ?customer=<id>&kind=<pan|aadhaar_front|aadhaar_back|photo>  body: the file  → { path }
//   GET  ?path=<stored path>                                                         → the original file
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MAX_BYTES = 5 * 1024 * 1024;
const KINDS = ['pan', 'aadhaar_front', 'aadhaar_back', 'photo'];
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

let key: Promise<CryptoKey> | null = null;
function aesKey() {
  key ??= admin.rpc('pii_key').then(({ data, error }) => {
    if (error || !data) { key = null; throw new Error('Encryption key unavailable'); }
    const raw = Uint8Array.from((data as string).match(/../g)!.map((h) => parseInt(h, 16)));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  });
  return key;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const params = new URL(req.url).searchParams;
  // Acting as the caller means row-level security decides what they may touch.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: 'Log in first.' }, 401);

  try {
    if (req.method === 'POST') {
      const customer = params.get('customer') ?? '';
      const kind = params.get('kind') ?? '';
      const type = (req.headers.get('content-type') ?? '').split(';')[0];
      if (!UUID.test(customer) || !KINDS.includes(kind)) return json({ error: 'Unknown customer or document type.' }, 400);
      if (!TYPES.includes(type)) return json({ error: 'Upload a photo (JPEG, PNG, WebP) or a PDF.' }, 415);
      const { data: allowed } = await caller.rpc('can_edit_kyc', { p_customer: customer });
      if (!allowed) return json({ error: 'You cannot change documents for this customer.' }, 403);
      const file = new Uint8Array(await req.arrayBuffer());
      if (!file.length) return json({ error: 'The file is empty.' }, 400);
      if (file.length > MAX_BYTES) return json({ error: 'That file is over 5 MB. Take a smaller photo or compress the PDF.' }, 413);

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), file));
      const stored = new Uint8Array(iv.length + sealed.length);
      stored.set(iv); stored.set(sealed, iv.length);

      const path = `${customer}/${kind}-${Date.now()}.enc`;
      const up = await admin.storage.from('kyc').upload(path, stored, { contentType: 'application/octet-stream' });
      if (up.error) return json({ error: up.error.message }, 500);
      // Recorded as the caller, so the activity log shows who uploaded it.
      const row = await caller.from('customer_documents').insert({ customer_id: customer, kind, path, mime: type });
      if (row.error) return json({ error: row.error.message }, 400);
      return json({ path });
    }

    if (req.method === 'GET') {
      const path = params.get('path') ?? '';
      // Only returns a row if the caller may see this customer.
      const { data: doc } = await caller.from('customer_documents').select('path, mime').eq('path', path).maybeSingle();
      if (!doc || !path.endsWith('.enc')) return json({ error: 'Not found.' }, 404);
      const { data: blob, error } = await admin.storage.from('kyc').download(path);
      if (error || !blob) return json({ error: 'Not found.' }, 404);
      const stored = new Uint8Array(await blob.arrayBuffer());
      const file = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.slice(0, 12) }, await aesKey(), stored.slice(12));
      return new Response(file, { headers: { ...cors, 'Content-Type': doc.mime ?? 'application/octet-stream', 'Cache-Control': 'private, no-store' } });
    }
    return json({ error: 'Method not allowed.' }, 405);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
