const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 'live' when Supabase env vars are present, otherwise the in-browser demo backend. */
export const backendMode: 'live' | 'demo' = url && key ? 'live' : 'demo';
export const supabaseUrl = url ?? '';
export const supabaseAnonKey = key ?? '';
