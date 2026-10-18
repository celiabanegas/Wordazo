import { supabase } from './supabase';

/** Tras cambiar los intereses, vacía las sugerencias «Para ti» de esta semana para que se vuelvan a calcular */
export async function resetForYou(userId: string) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  await supabase.from('user_suggestions').update({ items: [] }).eq('user_id', userId).eq('week', d.toISOString().slice(0, 10));
}
