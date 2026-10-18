import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { LANGS, type Lang } from './langs';

// Pronunciación con la voz del propio móvil u ordenador: no usa IA ni cuesta nada.

// En la web se usa directamente la voz del navegador, eligiendo una del idioma correcto.
// (Algunos navegadores se quedan mudos si se cancela justo antes de hablar o si no se indica la voz.)
const synth = Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices: SpeechSynthesisVoice[] = [];
if (synth) {
  const load = () => { try { voices = synth.getVoices(); } catch { /* nada */ } };
  load();
  try { synth.addEventListener?.('voiceschanged', load); } catch { synth.onvoiceschanged = load; }
}

function pickVoice(tag: string) {
  if (!voices.length && synth) voices = synth.getVoices();
  const lower = tag.toLowerCase();
  const base = lower.split('-')[0];
  const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === lower);
  const same = exact.length ? exact : voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  // Mejor una voz del propio dispositivo (funciona sin conexión y es más rápida)
  return same.find((v) => v.localService) || same[0] || null;
}

export function say(text: string, lang: Lang) {
  const clean = text.replace(/^to\s+/i, (m) => (lang === 'en' ? m : '')).trim();
  if (!clean) return;
  const tag = LANGS[lang].tts;
  if (synth) {
    try {
      if (synth.speaking || synth.pending) synth.cancel();
      synth.resume(); // Chrome a veces se queda en pausa
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = tag;
      u.rate = 0.9;
      const v = pickVoice(tag);
      if (v) u.voice = v;
      synth.speak(u);
    } catch { /* sin voz disponible */ }
    return;
  }
  try {
    Speech.stop();
    Speech.speak(clean, { language: tag, rate: 0.9 });
  } catch { /* sin voz disponible en este dispositivo */ }
}
