import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { Btn, Logo } from './ui';

// Introducción corta: sale la primera vez y se puede volver a ver desde Yo → Ajustes.
const KEY = 'wz-intro-v1';
const listeners = new Set<() => void>();
export const openIntro = () => listeners.forEach((f) => f());

export function useIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (!v) setShow(true); }).catch(() => {});
    const f = () => setShow(true);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  const close = () => { setShow(false); AsyncStorage.setItem(KEY, '1').catch(() => {}); };
  return { show, close };
}

type Slide = { title: string; text: string; art: (t: ReturnType<typeof useTheme>) => React.ReactNode };

const pill = (t: ReturnType<typeof useTheme>, label: string, on?: boolean) => (
  <View key={label} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.card }}>
    <Text style={{ color: on ? t.bg : t.ink, fontWeight: '700' }}>{label}</Text>
  </View>
);

const SLIDES: Slide[] = [
  {
    title: 'Aprende palabras jugando',
    text: 'Guardas las palabras que quieres aprender y Wordazo te las pregunta hasta que se te quedan.',
    art: () => <Logo size={44} />,
  },
  {
    title: 'Palabras → Añadir',
    text: 'Escribe una palabra y se traduce sola, con ejemplos. ¿No se te ocurre ninguna? Elige entre las sugerencias.',
    art: (t) => (
      <View style={{ width: '100%', gap: 8 }}>
        <View style={{ borderWidth: 2, borderColor: t.ink, borderRadius: 14, padding: 12, backgroundColor: t.card }}>
          <Text style={{ color: t.ink, fontSize: 17 }}>awkward</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '800' }}>Awkward</Text>
            <Text style={{ color: t.muted }}>Incómodo, torpe</Text>
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: t.goodSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.good, fontWeight: '800' }}>✓</Text>
          </View>
        </View>
      </View>
    ),
  },
  {
    title: 'Jugar → Elige',
    text: 'Elige la traducción correcta antes de que acabe el tiempo. Tienes 3 vidas y, si no la sabes, puedes pasar.',
    art: (t) => (
      <View style={{ width: '100%', gap: 6 }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 22, textAlign: 'center', marginBottom: 4 }}>Reliable</Text>
        {['Fiable', 'Relajado', 'Disponible'].map((o, i) => (
          <View key={o} style={{ borderRadius: 12, padding: 11, borderWidth: 1, borderColor: i === 0 ? t.good : t.line, backgroundColor: i === 0 ? t.goodSoft : t.card }}>
            <Text style={{ color: i === 0 ? t.good : t.ink, fontWeight: '700' }}>{o}</Text>
          </View>
        ))}
      </View>
    ),
  },
  {
    title: 'Repasa lo que te cuesta',
    text: 'Las que fallas varias veces se marcan como «Te cuesta» y salen más a menudo. Cuando las aciertas, dejan de estarlo.',
    art: (t) => (
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Text style={{ color: t.bad, backgroundColor: t.badSoft, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' }}>TE CUESTA</Text>
        <Text style={{ color: t.accentInk, backgroundColor: t.accent, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' }}>DOMINADA</Text>
      </View>
    ),
  },
  {
    title: 'Amigos y Yo',
    text: 'En Amigos retas a tus amigos y ves la liga de la semana. En Yo tienes tu racha, tus pegatinas y los ajustes.',
    art: (t) => <View style={{ flexDirection: 'row', gap: 6 }}>{['Jugar', 'Palabras', 'Amigos', 'Yo'].map((l, i) => pill(t, l, i >= 2))}</View>,
  },
];

export default function Intro({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, zIndex: 50 }} accessibilityViewIsModal>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 20, gap: 20, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: t.muted, fontWeight: '700' }}>{i + 1} de {SLIDES.length}</Text>
            {!last && <Text onPress={onClose} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', padding: 6 }}>Saltar</Text>}
          </View>
          <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
            <View style={{ minHeight: 190, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.line, padding: 20 }}>
              {s.art(t)}
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 }}>{s.title}</Text>
              <Text style={{ color: t.ink, fontSize: 17, lineHeight: 24, opacity: 0.85 }}>{s.text}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {SLIDES.map((_, k) => (
              <Pressable key={k} onPress={() => setI(k)} accessibilityLabel={`Paso ${k + 1}`} hitSlop={6}
                style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? t.ink : t.line }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {i > 0 && <Btn title="Atrás" kind="ghost" onPress={() => setI(i - 1)} style={{ flex: 1 }} />}
            <Btn big title={last ? 'Empezar' : 'Siguiente'} kind="accent" onPress={() => (last ? onClose() : setI(i + 1))} style={{ flex: 2 }} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
