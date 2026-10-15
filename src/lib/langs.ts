export type Lang = 'en' | 'fr' | 'de' | 'it' | 'pt' | 'es';

export const LANGS: Record<Lang, { name: string; code: string; tts: string; placeholder: string; sub?: string }> = {
  en: { name: 'Inglés', code: 'EN', tts: 'en-US', placeholder: 'Escribe una palabra en inglés…' },
  fr: { name: 'Francés', code: 'FR', tts: 'fr-FR', placeholder: 'Escribe una palabra en francés…' },
  de: { name: 'Alemán', code: 'DE', tts: 'de-DE', placeholder: 'Escribe una palabra en alemán…' },
  it: { name: 'Italiano', code: 'IT', tts: 'it-IT', placeholder: 'Escribe una palabra en italiano…' },
  pt: { name: 'Portugués', code: 'PT', tts: 'pt-PT', placeholder: 'Escribe una palabra en portugués…' },
  es: { name: 'Español culto', code: 'ES', tts: 'es-ES', placeholder: 'Escribe una palabra poco común…', sub: 'Palabras poco comunes' },
};
export const LANG_ORDER: Lang[] = ['en', 'fr', 'de', 'it', 'pt', 'es'];

export const LEVELS = [
  { v: 'low', l: 'Empiezo' },
  { v: 'mid', l: 'Me defiendo' },
  { v: 'high', l: 'Avanzado' },
] as const;
export type Level = (typeof LEVELS)[number]['v'];

export const TOPICS = [
  { v: 'series', l: 'Series y pelis' },
  { v: 'viajes', l: 'Viajes' },
  { v: 'redes', l: 'Redes' },
  { v: 'deporte', l: 'Deporte' },
  { v: 'clase', l: 'Clase' },
  { v: 'trabajo', l: 'Trabajo' },
  { v: 'comida', l: 'Comida' },
  { v: 'musica', l: 'Música' },
] as const;
