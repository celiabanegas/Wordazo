import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { EMPTY_STATS, type Deck, type Profile, type Stats, type Word } from './types';
import { norm, todayStr } from './text';
import { addProgress } from './progress';

type AddResult = 'added' | 'exists' | 'limit' | 'error';
type Progress = { xp: number; answered: number; correct: number; combo?: number; round?: number; perfect?: boolean };

type Store = {
  session: Session;
  profile: Profile;
  lang: Deck;
  words: Word[];
  loading: boolean;
  stats: Stats;
  xpDays: Record<string, number>;
  error: string | null;
  setError: (e: string | null) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addWord: (deck: Deck, term: string) => Promise<AddResult>;
  removeWord: (id: string) => Promise<void>;
  retryTranslate: (w: Word) => void;
  patchWord: (id: string, patch: Partial<Word>) => Promise<void>;
  recordProgress: (r: Progress) => Promise<{ goalJustMet: boolean; levelUp: boolean }>;
  setDailyGoal: (g: number) => Promise<void>;
  refresh: () => Promise<void>;
};

export const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de StoreProvider');
  return s;
};

export function StoreProvider({ session, initialProfile, children }: { session: Session; initialProfile: Profile; children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [xpDays, setXpDays] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const translating = useRef(new Set<string>());

  const patchLocal = (id: string, patch: Partial<Word>) => setWords((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const patchWord = useCallback(async (id: string, patch: Partial<Word>) => {
    patchLocal(id, patch);
    const { error: e } = await supabase.from('words').update(patch).eq('id', id);
    if (e) setError('No se pudo guardar el cambio. Revisa la conexión.');
  }, []);

  // Una sola llamada trae traducción, ejemplos y opciones para los juegos (con caché compartida en el servidor)
  const translate = useCallback(async (w: Word) => {
    if (translating.current.has(w.id)) return;
    translating.current.add(w.id);
    try {
      const { data, error: e } = await supabase.functions.invoke('translate', { body: { term: w.term, lang: w.deck } });
      if (e || !data || data.error) throw new Error('sin respuesta');
      if (!data.valid) {
        await patchWord(w.id, { status: 'error', note: w.deck === 'es' ? 'No reconozco esta palabra.' : 'No reconozco esta palabra. Revisa cómo se escribe.' });
        return;
      }
      const patch: Partial<Word> = {
        status: 'ok',
        meaning: data.translation,
        alts: (data.alternatives || []).filter((a: string) => norm(a) !== norm(data.translation)),
        examples: data.examples || [],
        example: data.examples?.[0]?.text || '',
        note: data.note || '',
        decoys: data.decoys || {},
      };
      // Corrige mayúsculas y tildes (p. ej. «haus» → «Haus») si es la misma palabra
      if (data.term && data.term !== w.term && norm(data.term) === norm(w.term)) patch.term = data.term;
      await patchWord(w.id, patch);
    } catch {
      await patchWord(w.id, { status: 'error', note: 'No se pudo traducir ahora. Inténtalo de nuevo.' });
    } finally {
      translating.current.delete(w.id);
    }
  }, [patchWord]);

  const refresh = useCallback(async () => {
    const since = new Date(); since.setDate(since.getDate() - 62);
    const [{ data: ws, error: e1 }, { data: st }, { data: days }] = await Promise.all([
      supabase.from('words').select('*').order('created_at', { ascending: false }),
      supabase.from('stats').select('*').maybeSingle(),
      supabase.from('xp_days').select('day, xp').gte('day', todayStr(since)),
    ]);
    if (e1) setError('No se pudieron cargar tus palabras. Revisa la conexión.');
    else {
      setError(null);
      const list = (ws || []) as Word[];
      setWords(list);
      list.filter((w) => w.status === 'pending').forEach((w) => translate(w));
    }
    if (st) setStats({ ...EMPTY_STATS, ...(st as Stats) });
    setXpDays(Object.fromEntries((days || []).map((d: { day: string; xp: number }) => [d.day, d.xp])));
    setLoading(false);
  }, [translate]);

  useEffect(() => { refresh(); }, [refresh, session.user.id]);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    const { error: e } = await supabase.from('profiles').update(patch).eq('user_id', session.user.id);
    if (e) setError('No se pudo guardar el ajuste.');
  }, [session.user.id]);

  const addWord = useCallback(async (deck: Deck, term: string): Promise<AddResult> => {
    term = term.trim();
    if (!term) return 'error';
    if (wordsRef.current.some((w) => w.deck === deck && norm(w.term) === norm(term))) return 'exists';
    const { data, error: e } = await supabase.from('words').insert({ deck, term }).select('*').single();
    if (e || !data) {
      if (e?.code === '23505') return 'exists';
      if (e?.message?.includes('daily_limit')) return 'limit';
      setError('No se pudo guardar la palabra.');
      return 'error';
    }
    setWords((ws) => [data as Word, ...ws]);
    translate(data as Word);
    return 'added';
  }, [translate]);

  const removeWord = useCallback(async (id: string) => {
    setWords((ws) => ws.filter((w) => w.id !== id));
    const { error: e } = await supabase.from('words').delete().eq('id', id);
    if (e) { setError('No se pudo borrar.'); refresh(); }
  }, [refresh]);

  const retryTranslate = useCallback((w: Word) => {
    patchLocal(w.id, { status: 'pending', note: '' });
    translate(w);
  }, [translate]);

  const saveStats = useCallback(async (s: Stats) => {
    setStats(s);
    const { error: e } = await supabase.from('stats').upsert({ user_id: session.user.id, ...s });
    if (e) setError('No se pudo guardar tu progreso.');
  }, [session.user.id]);

  const recordProgress = useCallback(async (r: Progress) => {
    const { next, goalJustMet, levelUp } = addProgress(statsRef.current, r);
    if (r.perfect) next.perfect_rounds = (next.perfect_rounds || 0) + 1;
    const day = todayStr();
    if (r.xp > 0) {
      setXpDays((d) => ({ ...d, [day]: (d[day] || 0) + r.xp }));
      supabase.rpc('log_xp', { p_day: day, p_xp: r.xp }).then(() => null);
    }
    await saveStats(next);
    return { goalJustMet, levelUp };
  }, [saveStats]);

  const setDailyGoal = useCallback(async (g: number) => {
    await saveStats({ ...statsRef.current, daily_goal: g });
  }, [saveStats]);

  const value = useMemo<Store>(() => ({
    session, profile, lang: profile.current_lang, words, loading, stats, xpDays, error, setError,
    updateProfile, addWord, removeWord, retryTranslate, patchWord, recordProgress, setDailyGoal, refresh,
  }), [session, profile, words, loading, stats, xpDays, error, updateProfile, addWord, removeWord, retryTranslate, patchWord, recordProgress, setDailyGoal, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
