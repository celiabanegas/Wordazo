import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { cap, shortMeaning, shuffle, norm } from '../lib/text';
import { ROUND_SIZE, clearOk, markOk, pickRound, playable, regrade, rememberRound } from '../lib/progress';
import { say } from '../lib/speech';
import { SPANISH_DECOYS, SPANISH_DEF_DECOYS } from '../lib/distractors';
import { isHard, type Deck, type Word } from '../lib/types';
import { Bar, Btn, Speaker } from '../components/ui';
import RoundSummary, { type RoundResult } from './RoundSummary';

const ROUND = ROUND_SIZE;
const LIVES = 3;
const SECONDS = 10;
const comboMult = (combo: number) => Math.min(4, 1 + Math.floor(combo / 3));

type Opt = { text: string; means: string };
type Q = { word: Word; reverse: boolean; prompt: string; answer: string; options: Opt[]; retry: boolean };

// Opciones falsas: primero las que Claude preparó para confundir (misma familia, parecidas en forma o sonido),
// después palabras de tu fichero y, si faltan, una lista de reserva.
function buildQuestion(word: Word, pool: Word[], deck: Deck, retry: boolean): Q {
  const hasTarget = (word.decoys?.target?.length ?? 0) >= 3 || pool.length >= 4;
  const reverse = hasTarget && (word.box >= 3 ? Math.random() < 0.5 : word.box === 2 ? Math.random() < 0.25 : false);
  const others = shuffle(pool.filter((w) => w.id !== word.id));
  let prompt: string, answer: string, cands: Opt[];
  if (!reverse) {
    prompt = word.term;
    answer = shortMeaning(word);
    cands = [
      ...shuffle(word.decoys?.native ?? []),
      ...others.map((w) => ({ text: shortMeaning(w), means: w.term })),
      ...shuffle(deck === 'es' ? SPANISH_DEF_DECOYS : SPANISH_DECOYS).map((x) => ({ text: x, means: '' })),
    ];
  } else {
    prompt = shortMeaning(word);
    answer = word.term;
    cands = [...shuffle(word.decoys?.target ?? []), ...others.map((w) => ({ text: w.term, means: shortMeaning(w) }))];
  }
  const avoid = new Set([norm(answer), ...(word.alts || []).map(norm)]);
  const picked: Opt[] = [];
  for (const c of cands) {
    if (picked.length >= 3) break;
    const n = norm(c.text);
    if (!n || avoid.has(n)) continue;
    avoid.add(n);
    picked.push(c);
  }
  return { word, reverse, prompt, answer, options: shuffle([{ text: answer, means: '' }, ...picked]), retry };
}

export default function ChoiceGame({ onExit, challengeId, hardOnly: hardProp }: { onExit: () => void; challengeId?: string; hardOnly?: boolean }) {
  const [allWords, setAllWords] = useState(false); // tras repasar «Te cuesta» se puede seguir con todas
  const hardOnly = !!hardProp && !allWords;
  const t = useTheme();
  const { words, patchWord, recordProgress, stats, lang: deck } = useStore();
  const pool = useMemo(() => playable(words, deck), [words, deck]);
  const [roundKey, setRoundKey] = useState(0);

  const initialQueue = useMemo(() => {
    // Cada palabra sale como mucho una vez por ronda (más una segunda oportunidad si la fallas).
    // Con pocas palabras, la ronda es más corta en lugar de repetir la misma una y otra vez.
    const base = hardOnly ? shuffle(pool.filter(isHard)).slice(0, 10) : pickRound(pool, deck, ROUND);
    rememberRound(deck, base.map((w) => w.id)); // Tarjetas y Escribe repasarán estas mismas
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, pool.length, hardOnly]);

  const [queue, setQueue] = useState<{ word: Word; retry: boolean }[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [roundId, setRoundId] = useState(0);
  const [i, setI] = useState(0);
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // texto elegido, '__timeout__' o '__skip__'
  const [timedOut, setTimedOut] = useState(false);
  const [lives, setLives] = useState(LIVES);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [gain, setGain] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [archivedMsg, setArchivedMsg] = useState(false);
  const graded = useRef(new Set<string>());

  const timer = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const gainY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setQueue(initialQueue.map((word) => ({ word, retry: false })));
    setI(0); setLives(LIVES); setCombo(0); setMaxCombo(0); setXp(0); setAnswered(0); setCorrect(0); setSkipped(0); setMissed([]);
    setResult(null); setPicked(null); setTimedOut(false); graded.current = new Set();
    setRoundId((r) => r + 1);
  }, [initialQueue]);

  useEffect(() => {
    const item = queueRef.current[i];
    if (!item) { setQ(null); return; }
    const fresh = pool.find((w) => w.id === item.word.id) || item.word;
    setQ(buildQuestion(fresh, pool, deck, item.retry));
    setPicked(null); setTimedOut(false); setArchivedMsg(false);
    timer.setValue(1);
    Animated.timing(timer, { toValue: 0, duration: SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished) setTimedOut(true);
    });
    return () => timer.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, roundId]);

  const finish = useCallback(async (f: { xp: number; answered: number; correct: number; maxCombo: number; lives: number; skipped: number }) => {
    if (f.lives > 0) clearOk(deck); // ronda completa: la siguiente empieza de cero
    const perfect = f.lives === LIVES && f.skipped === 0 && f.answered >= 5;
    const bonus = perfect ? Math.round(f.xp * 0.2) : 0;
    const total = f.xp + bonus;
    const prevBest = stats.best_round;
    const { goalJustMet, levelUp } = await recordProgress({ xp: total, answered: f.answered, correct: f.correct, combo: f.maxCombo, round: total, perfect });
    let challenge: RoundResult['challenge'];
    if (challengeId) {
      const { data } = await supabase.rpc('finish_challenge', { p_id: challengeId, p_xp: total });
      challenge = data === 'won' || data === 'lost' ? data : undefined;
    }
    setResult({ xp: total, bonus, perfect, answered: f.answered, correct: f.correct, maxCombo: f.maxCombo,
      record: total > prevBest && prevBest > 0, goalJustMet, levelUp, missed, outOfLives: f.lives <= 0, challenge });
  }, [recordProgress, stats.best_round, missed, challengeId]);

  const failWord = (w: Word) => {
    setMissed((m) => (m.some((x) => x.id === w.id) ? m : [...m, w]));
    if (!graded.current.has(w.id)) {
      graded.current.add(w.id);
      patchWord(w.id, { ...regrade(w, false), fails: (w.fails || 0) + 1 });
    }
  };
  const requeue = () => {
    // Solo se repite si quedan al menos 2 preguntas por medio (así no sale la misma justo después)
    if (q && !q.retry && queue.length - i > 2) setQueue((qq) => { const c = qq.slice(); c.splice(Math.min(c.length, i + 3), 0, { word: q.word, retry: true }); return c; });
  };

  const answer = (opt: string | null) => {
    if (!q || picked !== null || result) return;
    let left = 0;
    timer.stopAnimation((v) => { left = v; });
    const ok = opt !== null && norm(opt) === norm(q.answer);
    setPicked(opt ?? '__timeout__');
    const nAnswered = answered + 1;
    setAnswered(nAnswered);

    if (ok) {
      if (!graded.current.has(q.word.id)) { graded.current.add(q.word.id); patchWord(q.word.id, regrade(q.word, true)); markOk(deck, q.word.id); }
      const nCombo = combo + 1;
      const mult = comboMult(nCombo);
      const earned = (10 + Math.round(left * 5)) * mult;
      const nXp = xp + earned, nCorrect = correct + 1, nMax = Math.max(maxCombo, nCombo);
      setCombo(nCombo); setMaxCombo(nMax); setXp(nXp); setCorrect(nCorrect);
      setGain(`+${earned} XP${mult > 1 ? `  ×${mult}` : ''}`);
      gainY.setValue(0);
      Animated.timing(gainY, { toValue: 1, duration: 700, useNativeDriver: true }).start();
      if (nCombo % 3 === 0) {
        setBanner(nCombo >= 9 ? `¡Imparable! Combo ${nCombo}` : `¡Combo ×${mult}!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pop.setValue(1.6);
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        setTimeout(() => setBanner(null), 1100);
      } else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const last = i + 1 >= queue.length;
      setTimeout(() => {
        if (last) finish({ xp: nXp, answered: nAnswered, correct: nCorrect, maxCombo: nMax, lives, skipped });
        else setI((x) => x + 1);
      }, 650);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([10, -10, 7, -7, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))).start();
      setCombo(0);
      setLives((l) => l - 1);
      failWord(q.word);
      requeue();
    }
  };

  // «No la sé»: enseña la respuesta sin quitar vida, pero el combo vuelve a cero
  const skip = () => {
    if (!q || picked !== null || result) return;
    timer.stopAnimation();
    setPicked('__skip__');
    setAnswered((a) => a + 1);
    setSkipped((s) => s + 1);
    setCombo(0);
    failWord(q.word);
    requeue();
  };

  useEffect(() => { if (timedOut && picked === null) answer(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [timedOut]);

  const next = () => {
    if (lives <= 0 || i + 1 >= queue.length) finish({ xp, answered, correct, maxCombo, lives, skipped });
    else setI((x) => x + 1);
  };

  if (!pool.length) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 14 }}>
        <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>Primero guarda alguna palabra</Text>
        <Text style={{ color: t.muted }}>El reto usa las palabras que guardas en este idioma.</Text>
        <Btn title="Volver" onPress={onExit} />
      </View>
    );
  }

  if (result) return <RoundSummary title={hardOnly ? 'Repaso de lo que te cuesta' : 'Reto Elige'} result={result} onAgain={() => setRoundKey((k) => k + 1)} onExit={onExit} />;
  if (!q) {
    // Ronda vacía (p. ej. ya no queda ninguna en «Te cuesta»): nunca una pantalla en blanco
    if (initialQueue.length) return null;
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>{hardOnly ? '¡Ya no se te atasca ninguna!' : 'No hay palabras para jugar'}</Text>
        <Text style={{ color: t.muted, fontSize: 16 }}>{hardOnly ? 'Has acertado todas las que te costaban. Puedes seguir jugando con todas tus palabras.' : 'Las has sacado todas del juego. Puedes recuperarlas en Palabras → Mis palabras.'}</Text>
        {hardOnly && <Btn big kind="accent" title="Jugar con todas" onPress={() => { setAllWords(true); setRoundKey((k) => k + 1); }} />}
        <Btn title="Volver al inicio" kind={hardOnly ? 'ghost' : 'ink'} onPress={onExit} />
      </View>
    );
  }

  const answeredState = picked !== null;
  const wrong = answeredState && norm(picked!) !== norm(q.answer);
  const pickedOpt = q.options.find((o) => norm(o.text) === norm(picked || ''));
  const total = queue.length;
  const targetText = q.reverse ? q.answer : q.prompt; // la palabra en el idioma que aprendes

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Salir del reto" hitSlop={12}>
          <Text style={{ color: t.muted, fontSize: 22, fontWeight: '700' }}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}><Bar pct={i / total} color={t.ink} height={10} /></View>
        <Text style={{ color: t.bad, fontSize: 18, letterSpacing: 2 }} accessibilityLabel={`${lives} vidas`}>
          {'♥'.repeat(Math.max(0, lives))}<Text style={{ color: t.line }}>{'♥'.repeat(Math.max(0, LIVES - lives))}</Text>
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: pop }], flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: combo >= 3 ? t.fire : t.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: combo >= 3 ? t.fire : t.line }}>
          <Text style={{ fontSize: 15 }}>🔥</Text>
          <Text style={{ color: combo >= 3 ? '#fff' : t.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{combo}{comboMult(combo) > 1 ? `  ×${comboMult(combo)}` : ''}</Text>
        </Animated.View>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 18, fontVariant: ['tabular-nums'] }}>{xp} XP</Text>
      </View>

      <Animated.View style={{ transform: [{ translateX: shake }], backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 20, paddingBottom: 26, gap: 10 }}>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
          {q.retry ? 'OTRA OPORTUNIDAD · ' : ''}{q.reverse ? (deck === 'es' ? '¿QUÉ PALABRA ES?' : '¿CÓMO SE DICE?') : '¿QUÉ SIGNIFICA?'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: t.ink, fontSize: q.prompt.length > 28 ? 22 : 34, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 }}>{cap(q.prompt)}</Text>
          {!q.reverse && <Speaker size={34} onPress={() => say(q.prompt, deck)} label={`Escuchar ${q.prompt}`} />}
        </View>
        <Animated.View style={{ position: 'absolute', left: 20, right: 20, bottom: 12, height: 6, borderRadius: 6, overflow: 'hidden', backgroundColor: t.line }}>
          <Animated.View style={{ height: 6, backgroundColor: answeredState ? t.line : t.accent, width: timer.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </Animated.View>
        {gain && answeredState && !wrong && (
          <Animated.Text style={{ position: 'absolute', right: 20, top: 14, color: t.good, fontWeight: '800', fontSize: 16,
            opacity: gainY.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [{ translateY: gainY.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) }] }}>{gain}</Animated.Text>
        )}
      </Animated.View>

      {banner && <Text style={{ textAlign: 'center', color: t.fire, fontWeight: '800', fontSize: 20 }}>{banner}</Text>}

      <View style={{ gap: 9 }}>
        {q.options.map((o, k) => {
          const isAns = norm(o.text) === norm(q.answer);
          const isPicked = answeredState && norm(o.text) === norm(picked!);
          if (wrong && !isAns && !isPicked) return null; // tras fallar, solo tu respuesta y la buena
          const bg = !answeredState ? t.card : isAns ? t.goodSoft : isPicked ? t.badSoft : t.card;
          const bc = !answeredState ? t.line : isAns ? t.good : isPicked ? t.bad : t.line;
          return (
            <Pressable key={o.text + k} onPress={() => answer(o.text)} disabled={answeredState} accessibilityRole="button"
              style={({ pressed }) => ({ backgroundColor: pressed ? t.line : bg, borderColor: bc, borderWidth: isAns && answeredState ? 2 : 1,
                borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
                opacity: answeredState && !isAns && !isPicked ? 0.5 : 1 })}>
              <Text style={{ color: t.muted, fontWeight: '800', width: 18 }}>{'ABCD'[k]}</Text>
              <Text style={{ color: t.ink, fontSize: 17, fontWeight: '600', flex: 1 }}>{cap(o.text)}</Text>
              {answeredState && isAns && <Text style={{ color: t.good, fontWeight: '800' }}>✓</Text>}
              {isPicked && !isAns && <Text style={{ color: t.bad, fontWeight: '800' }}>✕</Text>}
            </Pressable>
          );
        })}
      </View>

      {!answeredState && (
        <Pressable onPress={skip} accessibilityRole="button"
          style={({ pressed }) => ({ alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line, backgroundColor: pressed ? t.line : 'transparent' })}>
          <Text style={{ color: t.muted, fontWeight: '700' }}>No la sé · Pasar</Text>
        </Pressable>
      )}

      {wrong && (
        <View style={{ backgroundColor: t.badSoft, borderRadius: 16, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: t.bad, fontWeight: '800' }}>
              {picked === '__timeout__' ? 'Se acabó el tiempo' : picked === '__skip__' ? 'Sin problema, apréndela' : 'Casi'}{lives <= 0 ? ' · sin vidas' : ''}
            </Text>
            {q.word.fails >= 1 && picked !== '__skip__' && <Text style={{ color: t.bad, fontSize: 12, fontWeight: '700' }}>{q.word.fails + 1}.º fallo con esta palabra</Text>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: t.ink, fontSize: 17, flexShrink: 1 }}><Text style={{ fontWeight: '800' }}>{cap(q.word.term)}</Text> = {cap(q.word.meaning)}</Text>
            <Speaker onPress={() => say(targetText, deck)} />
          </View>
          {(q.word.examples?.length ? q.word.examples : q.word.example ? [{ text: q.word.example, translation: '' }] : []).map((ex) => (
            <View key={ex.text} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', borderLeftWidth: 3, borderColor: t.bad, paddingLeft: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink }}>{ex.text}</Text>
                {!!ex.translation && <Text style={{ color: t.muted, fontSize: 13 }}>{ex.translation}</Text>}
              </View>
              <Speaker size={24} onPress={() => say(ex.text, deck)} label="Escuchar la frase" />
            </View>
          ))}
          {pickedOpt && !!pickedOpt.means && (
            <Text style={{ color: t.muted, fontSize: 13 }}><Text style={{ fontWeight: '800', color: t.ink }}>{cap(pickedOpt.text)}</Text> (la que elegiste) = {cap(pickedOpt.means)}</Text>
          )}
          {!!q.word.note && <Text style={{ color: t.bad, fontSize: 13 }}>{q.word.note}</Text>}
          <Btn title={lives <= 0 ? 'Ver resultado' : 'Continuar'} onPress={next} style={{ marginTop: 4 }} />
          <Text onPress={() => { patchWord(q.word.id, { archived: true }); setQueue((qq) => qq.filter((x, k) => k <= i || x.word.id !== q.word.id)); setArchivedMsg(true); }}
            accessibilityRole="button" style={{ color: t.muted, textAlign: 'center', fontWeight: '700', paddingTop: 4 }}>
            {archivedMsg ? 'Hecho: no volverá a salir en los juegos' : 'No preguntarme más esta palabra'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
