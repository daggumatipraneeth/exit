import { createClient } from '@supabase/supabase-js';

// PKCE keeps auth redirects in ?code=, so they don't collide with the portal's #/hash routes.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce' },
});
