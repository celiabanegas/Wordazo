import { Platform } from 'react-native';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY } from './config';

// Avisos en la versión web (Chrome, Edge, Firefox y Safari con la app añadida a la pantalla de inicio).
export const pushSupported = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const toKey = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Pide permiso y registra este dispositivo. Devuelve un texto de error para mostrar, o null si todo fue bien. */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return 'Este navegador no permite avisos. En iPhone, primero añade Wordazo a la pantalla de inicio.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Has bloqueado los avisos. Puedes activarlos en los ajustes del navegador.';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
  return error ? 'No se pudo activar el aviso. Inténtalo de nuevo.' : null;
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe().catch(() => null);
  }
}
