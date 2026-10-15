import * as Speech from 'expo-speech';
import { LANGS, type Lang } from './langs';

// Pronunciación con la voz del propio móvil u ordenador: no usa Claude ni cuesta nada.
export function say(text: string, lang: Lang) {
  try {
    Speech.stop();
    Speech.speak(text.replace(/^to\s+/i, (m) => (lang === 'en' ? m : '')), { language: LANGS[lang].tts, rate: 0.9 });
  } catch {
    /* sin voz disponible en este dispositivo */
  }
}
