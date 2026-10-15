import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

// Aviso para instalar la versión web en la pantalla de inicio o el escritorio.
// Solo aparece en el navegador y si la app no está ya instalada.

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

const KEY = 'wordazo.install.hidden';
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export default function InstallBanner() {
  const t = useTheme();
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);

  if (Platform.OS !== 'web' || hidden || isStandalone()) return null;
  const ios = isIOS();
  if (!deferred && !ios) return null; // el navegador no permite instalar desde aquí

  const close = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento */ }
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    force((n) => n + 1);
  };

  return (
    <View style={{ backgroundColor: t.ink, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.accentInk, fontWeight: '800', fontSize: 18 }}>W</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.bg, fontWeight: '800' }}>Ten Wordazo a mano</Text>
        <Text style={{ color: t.bg, opacity: 0.8, fontSize: 13 }}>
          {ios ? 'Toca Compartir y luego «Añadir a pantalla de inicio».' : 'Añádela a tu pantalla de inicio. No ocupa casi nada.'}
        </Text>
      </View>
      {!ios && (
        <Pressable onPress={install} accessibilityRole="button" style={{ backgroundColor: t.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: t.accentInk, fontWeight: '800' }}>Instalar</Text>
        </Pressable>
      )}
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar aviso" hitSlop={10}>
        <Text style={{ color: t.bg, opacity: 0.7, fontSize: 18, fontWeight: '700' }}>✕</Text>
      </Pressable>
    </View>
  );
}
