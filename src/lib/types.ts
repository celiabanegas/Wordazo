import type { Interests } from './langs';
import type { Lang, Level } from './langs';

export type Deck = Lang;
export type Pair = { text: string; means: string };

export type Word = {
  id: string;
  user_id?: string;
  deck: Deck;
  term: string;
  meaning: string;
  alts: string[];
  example: string;
  examples: { text: string; translation: string }[];
  decoys: { native?: Pair[]; target?: Pair[] };
  note: string;
  status: 'pending' | 'ok' | 'error';
  box: number;
  due_at: string;
  seen: number;
  fails: number;
  archived: boolean;
  created_at: string;
};

export type Stats = {
  xp: number;
  streak: number;
  best_streak: number;
  last_day: string | null;
  today_xp: number;
  daily_goal: number;
  best_combo: number;
  best_round: number;
  answered: number;
  correct: number;
  perfect_rounds: number;
};

export const EMPTY_STATS: Stats = {
  xp: 0, streak: 0, best_streak: 0, last_day: null, today_xp: 0, daily_goal: 60,
  best_combo: 0, best_round: 0, answered: 0, correct: 0, perfect_rounds: 0,
};

export type Profile = {
  user_id: string;
  display_name: string;
  birthdate: string | null;
  langs: Lang[];
  current_lang: Lang;
  native_lang: string;
  level: Level;
  friend_code: string;
  reminder_on: boolean;
  reminder_hour: number;
  tz: string;
  onboarded: boolean;
  username: string | null;
  interests: Interests | null;
  created_at: string;
};

export type Challenge = {
  id: string; mine: boolean; other_name: string; lang: Lang; target_xp: number;
  status: 'open' | 'accepted' | 'won' | 'lost'; result_xp: number | null; expires_at: string;
};

export const isHard = (w: Word) => w.fails >= 2 && w.box <= 2;
