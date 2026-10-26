import type { Stats, Word } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shuffle, todayStr } from './text';

// Repaso espaciado: días hasta el siguiente repaso según la caja (1–5)
export const INTERVAL_DAYS = [0, 0, 1, 3, 7, 21];

export function regrade(w: Word, correct: boolean): Partial<Word> {
  const box = correct ? Math.min(5, w.box + 1) : 1;
  const due = new Date(Date.now() + INTERVAL_DAYS[box] * 86400000 - (correct ? 3600000 : 0));
  // Si la aciertas, se borran sus fallos: deja de estar en «Te cuesta»
  return { box, due_at: due.toISOString(), seen: (w.seen || 0) + 1, ...(correct ? { fails: 0 } : {}) };
}

export const isDue = (w: Word) => new Date(w.due_at).getTime() <= Date.now();

// Niveles: cada nivel cuesta 50 XP más que el anterior (50, 100, 150…)
export function levelInfo(xp: number) {
  let level = 1, need = 50, base = 0;
  while (xp >= base + need) { base += need; level++; need = 50 * level; }
  return { level, into: xp - base, need, pct: (xp - base) / need };
}

export const LEVEL_NAMES = ['Principiante', 'Curioso', 'Aprendiz', 'Constante', 'Lector', 'Hablante', 'Fluido', 'Erudito', 'Políglota', 'Leyenda'];
export const levelName = (l: number) => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((l - 1) / 2))];

/** Suma XP y actualiza la racha de días. Devuelve las nuevas estadísticas y si hoy se ha cumplido el objetivo por primera vez. */
export function addProgress(s: Stats, r: { xp: number; answered: number; correct: number; combo?: number; round?: number }) {
  const today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = todayStr(y);
  let { streak, today_xp } = s;
  if (s.last_day !== today) {
    today_xp = 0;
    streak = s.last_day === yesterday ? streak + 1 : 1;
  }
  const before = today_xp;
  today_xp += r.xp;
  const next: Stats = {
    ...s,
    xp: s.xp + r.xp,
    today_xp,
    streak,
    best_streak: Math.max(s.best_streak, streak),
    last_day: today,
    answered: s.answered + r.answered,
    correct: s.correct + r.correct,
    best_combo: Math.max(s.best_combo, r.combo || 0),
    best_round: Math.max(s.best_round, r.round || 0),
  };
  const goalJustMet = before < s.daily_goal && today_xp >= s.daily_goal;
  const levelUp = levelInfo(next.xp).level > levelInfo(s.xp).level;
  return { next, goalJustMet, levelUp };
}

/** Racha vigente: si el último día fue antes de ayer, la racha está perdida. */
export function liveStreak(s: Stats) {
  if (!s.last_day) return 0;
  const today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  return s.last_day === today || s.last_day === todayStr(y) ? s.streak : 0;
}
export const todayXp = (s: Stats) => (s.last_day === todayStr() ? s.today_xp : 0);

/** Palabras con las que se puede jugar en un idioma (las que sacaste del juego no cuentan). */
export const playable = (words: Word[], deck: string) =>
  words.filter((w) => w.deck === deck && w.status === 'ok' && w.meaning && !w.archived);

// Elige: 15 preguntas por ronda, cada una de una palabra distinta
export const ROUND_SIZE = 15;
// Última ronda de Elige: Tarjetas y Escribe repasan esas mismas palabras
let lastRound: { deck: string; ids: string[] } | null = null;
export const rememberRound = (deck: string, ids: string[]) => { lastRound = { deck, ids }; };

// Rotación: cuándo salió cada palabra por última vez en Elige (se guarda en el dispositivo).
// Las que nunca han salido van primero; las acertadas, al final de la cola; las falladas vuelven antes.
const KEY = 'wz-ultima-vez';
const DAY = 86400000;
let askedAt: Record<string, number> = {};
AsyncStorage.getItem(KEY).then((v) => { if (v) askedAt = { ...JSON.parse(v), ...askedAt }; }).catch(() => {});
let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function markAsked(id: string, correct: boolean) {
  askedAt[id] = Date.now() - (correct ? 0 : 2 * DAY);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(askedAt)).catch(() => {}); }, 500);
}

/** Elige elige las 15 que hace más tiempo que no salen (las nuevas primero); Tarjetas y Escribe repasan las de la última ronda de Elige. */
export function pickRound(pool: Word[], deck: string, n = ROUND_SIZE, reuse = false): Word[] {
  if (reuse && lastRound?.deck === deck) {
    const byId = new Map(pool.map((w) => [w.id, w]));
    const same = lastRound.ids.map((id) => byId.get(id)).filter((w): w is Word => !!w);
    if (same.length) return shuffle(same);
  }
  const at = (w: Word) => askedAt[w.id] ?? 0;
  return shuffle(pool).sort((a, b) => at(a) - at(b) || a.box - b.box).slice(0, n);
}
