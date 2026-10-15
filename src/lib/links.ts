import { Platform } from 'react-native';

// Enlaces de invitación: ?amigo=CÓDIGO y ?reto=ID. Se guardan hasta que la persona entra en su cuenta.
// ?permiso=TOKEN es el enlace que recibe la madre, padre o tutor.
const KEY = 'wordazo.pending';
type Pending = { amigo?: string; reto?: string };

export function readUrlParams(): Pending & { permiso?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const out = { amigo: q.get('amigo') || undefined, reto: q.get('reto') || undefined, permiso: q.get('permiso') || undefined };
  if (out.amigo || out.reto) {
    try { localStorage.setItem(KEY, JSON.stringify({ amigo: out.amigo, reto: out.reto })); } catch { /* sin almacenamiento */ }
  }
  if (out.amigo || out.reto || out.permiso) {
    // Limpia la barra de direcciones (el permiso se mantiene hasta que se use)
    if (!out.permiso) window.history.replaceState(null, '', window.location.pathname);
  }
  return out;
}

export function takePending(): Pending {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return {};
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    localStorage.removeItem(KEY);
    return v;
  } catch { return {}; }
}

export const siteOrigin = (fallback: string) =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : fallback;
