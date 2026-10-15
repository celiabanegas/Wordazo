import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { acceptedAnswers, cap, capList, norm, stripEs } from '../lib/text';
import { pickRound, playable, regrade, ROUND_SIZE } from '../lib/progress';
import type { Deck, Word } from '../lib/types';
import { Bar, Btn, Card, Speaker } from '../components/ui';
import { say } from '../lib/speech';
import RoundSummary, { type RoundResult } from './RoundSummary';

const XP_PER = { cards: 6, write: 12 };

function useRound(deck: Deck) {
  const { words } = useStore();
  const [key, setKey] = useState(0);
  const queue = useMemo(() => {
    // Las mismas palabras que la última ronda de Elige (o, si aún no has jugado, elegidas igual que en Elige)
    return pickRound(playable(words, deck), deck, ROUND_SIZE, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, deck]);
  return { queue, again: () => setKey((k) => k + 1) };
}

function Header({ i, total, onExit, label }: { i: number; total: number; onExit: () => void; label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onExit} hitSlop={12} accessibilityRole="button" accessibilityLabel="Salir">
          <Text style={{ color: t.muted, fontSize: 22, fontWeight: '700' }}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}><Bar pct={i / total} color={t.ink} height={10} /></View>
        <Text style={{ color: t.muted, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{Math.min(i + 1, total)}/{total}</Text>
      </View>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

function useFinish(game: 'cards' | 'write') {
  const { recordProgress } = useStore();
  const [result, setResult] = useState<RoundResult | null>(null);
  const finish = async (correct: number, answered: number, missed: Word[]) => {
    const xp = correct * XP_PER[game];
    const r = await recordProgress({ xp, answered, correct });
    setResult({ xp, bonus: 0, perfect: correct === answered && answered >= 5, answered, correct, maxCombo: 0, record: false,
      goalJustMet: r.goalJustMet, levelUp: r.levelUp, missed });
  };
  return { result, setResult, finish };
}

export function CardsGame({ onExit }: { onExit: () => void }) {
  const t = useTheme();
  const { patchWord, lang: deck } = useStore();
  const { queue, again } = useRound(deck);
  const { result, setResult, finish } = useFinish('cards');
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);

  if (result) return <RoundSummary title="Tarjetas" result={result} onExit={onExit} onAgain={() => { setResult(null); setI(0); setOk(0); setMissed([]); setOpen(false); again(); }} />;
  if (!queue.length) return <Empty onExit={onExit} />;
  const w = queue[i];

  const grade = (g: 0 | 1 | 2) => {
    if (g === 2) { patchWord(w.id, regrade(w, true)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
    if (g === 0) { patchWord(w.id, { ...regrade(w, false), fails: (w.fails || 0) + 1 }); }
    const nOk = ok + (g === 2 ? 1 : 0);
    const nMissed = g === 0 ? [...missed, w] : missed;
    setOk(nOk); setMissed(nMissed); setOpen(false);
    if (i + 1 >= queue.length) finish(nOk, queue.length, nMissed);
    else setI(i + 1);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}>
      <Header i={i} total={queue.length} onExit={onExit} label="TARJETAS · ¿SABES QUÉ SIGNIFICA?" />
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Girar tarjeta"
        style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 22, minHeight: 300, justifyContent: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: t.ink, fontSize: 38, fontWeight: '800', letterSpacing: -0.8, flexShrink: 1 }}>{cap(w.term)}</Text>
          <Speaker size={34} onPress={() => say(w.term, deck)} />
        </View>
        {open ? (
          <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: t.line, paddingTop: 14, gap: 6 }}>
            <Text style={{ color: t.ink, fontSize: 22, fontWeight: '700' }}>{cap(w.meaning)}</Text>
            {w.alts.length > 0 && <Text style={{ color: t.muted }}>También: {capList(w.alts)}</Text>}
            {!!w.example && <Text style={{ color: t.muted, fontStyle: 'italic' }}>{w.example}</Text>}
          </View>
        ) : <Text style={{ color: t.muted }}>Piensa la traducción y toca para comprobarla</Text>}
      </Pressable>
      {open ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="No la sabía" kind="bad" style={{ flex: 1 }} onPress={() => grade(0)} />
          <Btn title="Dudé" kind="ghost" style={{ flex: 1 }} onPress={() => grade(1)} />
          <Btn title="La sabía" kind="good" style={{ flex: 1 }} onPress={() => grade(2)} />
        </View>
      ) : <Btn title="Ver traducción" big onPress={() => setOpen(true)} />}
    </ScrollView>
  );
}

export function WriteGame({ onExit }: { onExit: () => void }) {
  const t = useTheme();
  const { patchWord, lang: deck } = useStore();
  const { queue, again } = useRound(deck);
  const { result, setResult, finish } = useFinish('write');
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [state, setState] = useState<null | 'ok' | 'ko'>(null);
  const [ok, setOk] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [prev, setPrev] = useState<Word | null>(null);

  if (result) return <RoundSummary title="Escribe" result={result} onExit={onExit} onAgain={() => { setResult(null); setI(0); setOk(0); setMissed([]); setState(null); setValue(''); again(); }} />;
  if (!queue.length) return <Empty onExit={onExit} />;
  const w = queue[i];
  const en = deck !== 'es';
  const solution = en ? capList([w.meaning, ...w.alts]) : cap(w.term);

  const check = (giveUp = false) => {
    if (state || (!giveUp && !value.trim())) return;
    const good = !giveUp && (en ? acceptedAnswers(w).has(stripEs(value)) : norm(value) === norm(w.term));
    setPrev(w);
    patchWord(w.id, good ? regrade(w, true) : { ...regrade(w, false), fails: (w.fails || 0) + 1 });
    setState(good ? 'ok' : 'ko');
    if (good) { setOk(ok + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
    else { setMissed([...missed, w]); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  };
  const override = () => {
    if (!prev) return;
    patchWord(prev.id, regrade(prev, true));
    setState('ok'); setOk(ok + 1); setMissed(missed.filter((m) => m.id !== prev.id));
  };
  const next = () => {
    setState(null); setValue('');
    if (i + 1 >= queue.length) finish(ok, queue.length, missed);
    else setI(i + 1);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Header i={i} total={queue.length} onExit={onExit} label={en ? 'ESCRIBE LA TRADUCCIÓN EN ESPAÑOL' : 'ESCRIBE LA PALABRA'} />
      <Card style={{ minHeight: 160, justifyContent: 'center', gap: 8, borderRadius: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: t.ink, fontSize: en ? 36 : 21, fontWeight: en ? '800' : '700', flexShrink: 1 }}>{cap(en ? w.term : w.meaning)}</Text>
          {en && <Speaker size={34} onPress={() => say(w.term, deck)} />}
        </View>
        {state && !!w.example && <Text style={{ color: t.muted, fontStyle: 'italic' }}>{w.example}</Text>}
      </Card>
      <TextInput value={value} onChangeText={setValue} editable={!state} autoFocus autoCapitalize="none" autoCorrect={false}
        placeholder={en ? 'Escribe en español…' : 'Escribe la palabra…'} placeholderTextColor={t.muted} onSubmitEditing={() => (state ? next() : check())}
        style={{ backgroundColor: t.card, borderWidth: 2, borderColor: state === 'ok' ? t.good : state === 'ko' ? t.bad : t.line, borderRadius: 14,
          paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, color: t.ink }} />
      {state ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: state === 'ok' ? t.good : t.bad, fontWeight: '800', fontSize: 16 }}>
            {state === 'ok' ? `¡Correcto! +${XP_PER.write} XP` : (en ? 'Respuestas válidas: ' : 'Era: ') + solution}
          </Text>
          {state === 'ok' && en && <Text style={{ color: t.muted }}>{solution}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {state === 'ko' && !!value.trim() && <Btn title="Mi respuesta valía" kind="ghost" style={{ flex: 1 }} onPress={override} />}
            <Btn title="Siguiente" style={{ flex: 1 }} onPress={next} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="No me sale" kind="ghost" style={{ flex: 1 }} onPress={() => check(true)} />
          <Btn title="Comprobar" kind="accent" style={{ flex: 1 }} onPress={() => check()} />
        </View>
      )}
    </ScrollView>
  );
}

function Empty({ onExit }: { onExit: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 14 }}>
      <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>Aún no hay palabras listas</Text>
      <Text style={{ color: t.muted }}>Guarda alguna palabra y vuelve a jugar.</Text>
      <Btn title="Volver" onPress={onExit} />
    </View>
  );
}
