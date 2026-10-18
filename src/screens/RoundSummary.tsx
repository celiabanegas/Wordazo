import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { levelInfo, levelName, liveStreak, todayXp } from '../lib/progress';
import type { Word } from '../lib/types';
import { cap } from '../lib/text';
import { Bar, Btn, Card, Label } from '../components/ui';

export type RoundResult = {
  xp: number; bonus: number; perfect: boolean; answered: number; correct: number; maxCombo: number;
  record: boolean; goalJustMet: boolean; levelUp: boolean; missed: Word[]; outOfLives?: boolean; challenge?: 'won' | 'lost';
};

export default function RoundSummary({ result, onAgain, onExit, title = 'Reto Elige' }: { result: RoundResult; onAgain: () => void; onExit: () => void; title?: string }) {
  const t = useTheme();
  const { stats } = useStore();
  const lv = levelInfo(stats.xp);
  const today = todayXp(stats);
  const streak = liveStreak(stats);
  const acc = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  const count = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = React.useState(0);

  useEffect(() => {
    const id = count.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(count, { toValue: result.xp, duration: 900, useNativeDriver: false }).start();
    if (result.levelUp || result.goalJustMet || result.record) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return () => count.removeListener(id);
  }, [count, result]);

  const headline = result.challenge === 'won' ? '¡Reto superado!' : result.challenge === 'lost' ? 'Reto no superado' : result.levelUp ? `¡Nivel ${lv.level}!` : result.record ? '¡Nuevo récord!' : result.perfect ? '¡Ronda perfecta!' : result.outOfLives ? 'Sin vidas' : acc >= 80 ? '¡Muy bien!' : 'Ronda terminada';
  const toGoal = Math.max(0, stats.daily_goal - today);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 10 }}>
        <Label>{result.levelUp ? levelName(lv.level) : title}</Label>
        <Text style={{ color: t.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>{headline}</Text>
        <Text style={{ color: t.ink, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2 }}>+{shown}</Text>
        <Text style={{ color: t.muted, fontWeight: '700' }}>XP{result.bonus ? `  (incluye +${result.bonus} por no fallar)` : ''}</Text>
      </View>

      {result.challenge && (
        <Card style={{ backgroundColor: result.challenge === 'won' ? t.goodSoft : t.badSoft, borderColor: 'transparent' }}>
          <Text style={{ color: result.challenge === 'won' ? t.good : t.bad, fontWeight: '800', textAlign: 'center' }}>
            {result.challenge === 'won' ? 'Has superado la puntuación de tu amigo. Lo verá en Amigos.' : 'Esta vez no. Pídele otro reto y vuelve a intentarlo.'}
          </Text>
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Aciertos" value={`${acc}%`} />
        <Stat label="Mejor combo" value={`🔥 ${result.maxCombo}`} />
        <Stat label="Racha" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} />
      </View>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.ink, fontWeight: '800' }}>Objetivo de hoy</Text>
          <Text style={{ color: t.muted, fontVariant: ['tabular-nums'] }}>{Math.min(today, stats.daily_goal)}/{stats.daily_goal} XP</Text>
        </View>
        <Bar pct={today / stats.daily_goal} color={today >= stats.daily_goal ? t.good : t.accent} height={12} />
        <Text style={{ color: today >= stats.daily_goal ? t.good : t.muted, fontWeight: today >= stats.daily_goal ? '700' : '400' }}>
          {result.goalJustMet ? 'Objetivo cumplido. Tu racha sigue viva.' : today >= stats.daily_goal ? 'Objetivo de hoy cumplido.' : `Te faltan ${toGoal} XP. Una ronda más y lo tienes.`}
        </Text>
        <View style={{ height: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.ink, fontWeight: '800' }}>Nivel {lv.level} · {levelName(lv.level)}</Text>
          <Text style={{ color: t.muted, fontVariant: ['tabular-nums'] }}>{lv.into}/{lv.need}</Text>
        </View>
        <Bar pct={lv.pct} color={t.blue} height={8} />
      </Card>

      {result.missed.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Text style={{ color: t.ink, fontWeight: '800' }}>Para repasar</Text>
          {result.missed.map((w) => (
            <Text key={w.id} style={{ color: t.ink }}><Text style={{ fontWeight: '800' }}>{cap(w.term)}</Text>  {cap(w.meaning)}</Text>
          ))}
        </Card>
      )}

      <Btn title="Otra ronda" kind="accent" big onPress={onAgain} />
      <Btn title="Volver al inicio" kind="ghost" onPress={onExit} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, gap: 2 }}>
      <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700' }}>{label.toUpperCase()}</Text>
    </Card>
  );
}
