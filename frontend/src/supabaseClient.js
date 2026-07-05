import {createClient} from '@supabase/supabase-js;'
const supabaseurl=import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=createClient(supabaseurl,supabaseAnonKey);

