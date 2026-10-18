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
  { v: 'tecnologia', l: 'Tecnología' },
  { v: 'videojuegos', l: 'Videojuegos' },
  { v: 'moda', l: 'Moda' },
  { v: 'ciencia', l: 'Ciencia' },
  { v: 'negocios', l: 'Negocios' },
  { v: 'naturaleza', l: 'Naturaleza' },
] as const;

// Personalización de las sugerencias (se pregunta al empezar y se cambia en Yo → Ajustes)
export const GOALS = [
  { v: 'viajar', l: 'Viajar' },
  { v: 'trabajo', l: 'Para mi trabajo', adult: true },
  { v: 'estudios', l: 'Estudios y exámenes' },
  { v: 'ocio', l: 'Series, música y juegos' },
  { v: 'gente', l: 'Hablar con gente' },
  { v: 'vivir', l: 'Vivir fuera' },
] as const;
export const SITUATIONS = [
  { v: 'instituto', l: 'Voy al instituto' },
  { v: 'uni', l: 'Universidad o FP', adult: true },
  { v: 'trabajo', l: 'Trabajo', adult: true },
  { v: 'busco', l: 'Busco trabajo', adult: true },
  { v: 'otro', l: 'Otra cosa' },
] as const;
export const SECTORS = [
  { v: 'tecnologia', l: 'Tecnología' },
  { v: 'salud', l: 'Salud' },
  { v: 'hosteleria', l: 'Hostelería y turismo' },
  { v: 'comercio', l: 'Comercio y ventas' },
  { v: 'educacion', l: 'Educación' },
  { v: 'ingenieria', l: 'Ingeniería e industria' },
  { v: 'finanzas', l: 'Administración y finanzas' },
  { v: 'diseno', l: 'Arte, diseño y comunicación' },
  { v: 'campo', l: 'Campo y medio ambiente' },
  { v: 'derecho', l: 'Derecho' },
] as const;
export type Interests = { goals?: string[]; situation?: string; sector?: string; job?: string; topics?: string[] };
