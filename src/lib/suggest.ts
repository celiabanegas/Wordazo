import { Platform } from 'react-native';
import type { Lang } from './langs';
import { SITE_URL } from './config';

// Listas de palabras por idioma (palabras frecuentes más sus formas: plurales, conjugaciones…).
// Están en public/words/ y se descargan solo las del idioma que se usa, una vez; el service worker las guarda para usarlas sin conexión.
const LISTS: Partial<Record<Lang, string[]>> = {};
const loading: Partial<Record<Lang, Promise<string[]>>> = {};
export function loadWords(lang: Lang): Promise<string[]> {
  if (LISTS[lang]) return Promise.resolve(LISTS[lang]!);
  if (!loading[lang]) {
    const url = `${Platform.OS === 'web' ? '' : SITE_URL}/words/${lang}.txt?v=2`;
    loading[lang] = fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => (LISTS[lang] = t.split('\n').filter(Boolean)))
      .catch(() => { delete loading[lang]; return []; });
  }
  return loading[lang]!;
}

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
  if (!words) { loadWords(lang); return { list: [], fuzzy: false }; }
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
  const list = out.concat(near.slice(0, limit - out.length).map((x) => x[2]));
  return { list, fuzzy: out.length === 0 && near.length > 0 && near[0][0] > 0 };
}
