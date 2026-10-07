import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// PKCE keeps auth redirects in ?code=, so they don't collide with the portal's #/hash routes.
// null when the build has no Supabase settings (see PORTAL.md); the portal then says it isn't set up.
export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;
