import type { Word } from './types';

/** Minúsculas, sin acentos ni signos, sin "to" inicial de los verbos ingleses. */
export const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^to\s+/, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Igual que norm, quitando además artículos y "se" iniciales en español. */
export const stripEs = (s: string) => norm(s).replace(/^(el|la|los|las|un|una|unos|unas|lo|se) /, '');

/** Todas las traducciones que se aceptan como correctas en el juego «Escribe». */
export function acceptedAnswers(w: Word): Set<string> {
  return new Set(
    [w.meaning, ...(w.alts || [])]
      .join(',')
      .replace(/\([^)]*\)/g, '')
      .split(/[,;/]|\bo\b/)
      .map(stripEs)
      .filter(Boolean),
  );
}

/** Traducción principal sin aclaraciones entre paréntesis (para mostrarla como opción). */
export const shortMeaning = (w: Word) => w.meaning.replace(/\s*\([^)]*\)/g, '').trim();

export function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Formato único para mostrar palabras: primera letra en mayúscula y el resto en minúscula */
export const cap = (s: string) => {
  const t = String(s || '').trim();
  return t ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1).toLocaleLowerCase('es') : t;
};
export const capList = (a: string[]) => a.map(cap).join(', ');
