import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

// Datos públicos del proyecto (la clave publicable puede ir en la app; la seguridad la dan las reglas RLS)
export const SUPABASE_URL = 'https://ynnqmnkgcwqgzgrsdkaf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gbsTl7IDBO07KqQX6YZNAg_P3KkACyr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    lock: processLock,
  },
});

// Renueva la sesión solo mientras la app está en primer plano
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
