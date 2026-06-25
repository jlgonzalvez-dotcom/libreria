import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from 'astro:env/server';
import type { Database } from './database.types';

// Cliente de Supabase para uso EXCLUSIVO en el servidor (SSR / endpoints).
// Usa la service_role key, que ignora las políticas RLS. NUNCA debe llegar al
// navegador: todo el acceso a datos pasa por las páginas/endpoints de Astro.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
