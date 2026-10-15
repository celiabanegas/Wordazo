import type { Lang } from './langs';
import en from './wordlists/en';
import fr from './wordlists/fr';
import de from './wordlists/de';
import it from './wordlists/it';
import pt from './wordlists/pt';
import es from './wordlists/es';

const LISTS: Record<Lang, string[]> = { en, fr, de, it, pt, es };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Distancia de edición con transposición (recieve → receive cuenta como 1)
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pp: number[] | null = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    pp = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Sugerencias mientras se escribe: primero por prefijo; si hay pocas, palabras parecidas (corrige erratas). */
export function suggest(input: string, lang: Lang, limit = 6): { list: string[]; fuzzy: boolean } {
  const q = fold(input.trim().replace(/^to\s+/i, ''));
  if (q.length < 2 || /[0-9]/.test(q)) return { list: [], fuzzy: false };
  const words = LISTS[lang];
  const out: string[] = [];
  for (const w of words) {
    if (out.length >= limit) break;
    if (fold(w).startsWith(q)) out.push(w);
  }
  if (out.length >= 3 || q.length < 4) return { list: out, fuzzy: false };
  const max = q.length < 6 ? 1 : 2;
  const near: [number, number, string][] = [];
  words.forEach((w, i) => {
    if (out.includes(w)) return;
    const d = distance(q, fold(w), max);
    if (d <= max) near.push([d, i, w]);
  });
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { list: out.concat(near.slice(0, limit - out.length).map((x) => x[2])), fuzzy: out.length === 0 && near.length > 0 };
}
