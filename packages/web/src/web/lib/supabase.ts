import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sbqtttyuxiyeiduunzyc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NmEacaaoXyaHdvU466uQ9w_Pzr3whIz';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);