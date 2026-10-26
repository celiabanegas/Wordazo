import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { isDue, levelInfo, liveStreak, todayXp } from '../lib/progress';
import { isHard } from '../lib/types';
import { cap } from '../lib/text';
import { Bar, Btn } from '../components/ui';

export type Game = 'choice' | 'cards' | 'write';

export default function PlayScreen({ onPlay, onAddWords }: { onPlay: (g: Game, o?: { hardOnly?: boolean }) => void; onAddWords: () => void }) {
  const t = useTheme();
  const { words, stats, lang } = useStore();
  const ready = words.filter((w) => w.deck === lang && w.status === 'ok' && !w.archived);
  const due = ready.filter(isDue).length;
  const hard = ready.filter(isHard);
  const lv = levelInfo(stats.xp);
  const today = todayXp(stats);
  const streak = liveStreak(stats);
  const done = today >= stats.daily_goal;

  if (!ready.length) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Guarda tu primera palabra</Text>
        <Text style={{ color: t.muted, textAlign: 'center', maxWidth: 280 }}>Los juegos usan las palabras que tú guardas. Si no se te ocurre ninguna, te proponemos algunas.</Text>
        <Btn title="Añadir palabras" kind="accent" onPress={onAddWords} style={{ marginTop: 8, alignSelf: 'stretch', maxWidth: 360 }} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 14, flexGrow: 1, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: streak ? t.fire : t.muted, fontWeight: '800', fontSize: 16 }}>🔥 {streak} {streak === 1 ? 'día' : 'días'}</Text>
          <Text style={{ color: t.muted, fontWeight: '700' }}>· Nivel {lv.level}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ color: done ? t.good : t.muted, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {done ? 'Objetivo cumplido ✓' : `Hoy ${today}/${stats.daily_goal} XP`}
          </Text>
        </View>
        <Bar pct={today / stats.daily_goal} color={done ? t.good : t.accent} height={10} />
      </View>

      <Pressable onPress={() => onPlay('choice')} accessibilityRole="button" accessibilityLabel="Jugar a Elige"
        style={({ pressed }) => ({ flex: 1, minHeight: 240, backgroundColor: t.accent, borderRadius: 26, padding: 22, justifyContent: 'space-between',
          transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.accentInk, fontSize: 44, fontWeight: '800', letterSpacing: -1.2 }}>Elige</Text>
          <Text style={{ color: t.accentInk, fontSize: 17 }}>{Math.min(15, ready.length)} {Math.min(15, ready.length) === 1 ? 'pregunta' : 'preguntas'} · 3 vidas · contra el reloj</Text>
          {due > 0 && <Text style={{ color: t.accentInk, fontSize: 15, fontWeight: '700', marginTop: 6 }}>Incluye tus {due} {due === 1 ? 'palabra' : 'palabras'} por repasar</Text>}
        </View>
        <View style={{ backgroundColor: t.accentInk, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: t.accent, fontSize: 19, fontWeight: '800' }}>Jugar</Text>
        </View>
      </Pressable>

      {ready.length < 5 && (
        <Pressable onPress={onAddWords} accessibilityRole="button" style={{ backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12 }}>
          <Text style={{ color: t.ink }}>
            Tienes {ready.length} {ready.length === 1 ? 'palabra' : 'palabras'}: cada ronda las pregunta una vez. <Text style={{ color: t.blue, fontWeight: '800' }}>Añade más</Text> para rondas más largas.
          </Text>
        </Pressable>
      )}

      {hard.length > 0 && (
        <Pressable onPress={() => onPlay('choice', { hardOnly: true })} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.badSoft, borderRadius: 16, padding: 14, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: t.bad, fontWeight: '800', fontSize: 16 }}>Te {hard.length === 1 ? 'cuesta 1 palabra' : `cuestan ${hard.length} palabras`}</Text>
            <Text style={{ color: t.muted }} numberOfLines={1}>{hard.slice(0, 4).map((w) => cap(w.term)).join(', ')}</Text>
          </View>
          <Text style={{ color: '#fff', backgroundColor: t.bad, fontWeight: '800', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden' }}>Repasar</Text>
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Mode title="Tarjetas" sub="Repaso tranquilo" onPress={() => onPlay('cards')} />
        <Mode title="Escribe" sub="Teclea la traducción" onPress={() => onPlay('write')} />
      </View>
    </ScrollView>
  );
}

function Mode({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? t.line : t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, paddingVertical: 14, paddingHorizontal: 14 })}>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text>
    </Pressable>
  );
}
