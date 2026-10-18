import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { suggest } from '../lib/suggest';
import { cap, capList, norm, shuffle } from '../lib/text';
import { isDue } from '../lib/progress';
import { say } from '../lib/speech';
import { supabase } from '../lib/supabase';
import { LANGS, TOPICS, type Lang } from '../lib/langs';
import { isHard, type Word } from '../lib/types';
import { DAILY_WORD_LIMIT } from '../lib/config';
import { Btn, Chip, Speaker } from '../components/ui';

type Sugg = { term: string; translation: string; reason?: string };

export default function WordsScreen({ onPlay }: { onPlay: () => void }) {
  const t = useTheme();
  const { words, addWord, removeWord, retryTranslate, patchWord, loading, lang } = useStore();
  const [term, setTerm] = useState('');
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const mine = useMemo(() => words.filter((w) => w.deck === lang), [words, lang]);
  const saved = useMemo(() => new Set(mine.map((w) => norm(w.term))), [mine]);
  const sugg = useMemo(() => suggest(term, lang, 6), [term, lang]);
  const shown = useMemo(() => {
    const nq = norm(q);
    return nq ? mine.filter((w) => norm(w.term).includes(nq) || norm(w.meaning).includes(nq)) : mine;
  }, [mine, q]);
  const due = mine.filter((w) => w.status === 'ok' && !w.archived && isDue(w)).length;

  const save = async (value: string) => {
    const v = value.trim();
    if (!v) return 'error' as const;
    setTerm('');
    const r = await addWord(lang, v);
    if (r === 'added') { Haptics.selectionAsync(); setFlash({ text: `«${v}» guardada` }); }
    else if (r === 'exists') setFlash({ text: `«${v}» ya la tienes` });
    else if (r === 'limit') setFlash({ text: `Has llegado a ${DAILY_WORD_LIMIT} palabras nuevas hoy. Mañana puedes seguir; mientras, ¡a jugar!`, bad: true });
    else setFlash({ text: 'No se pudo guardar. Revisa la conexión.', bad: true });
    setTimeout(() => setFlash(null), 3000);
    return r;
  };

  const typing = term.trim().length > 0;
  const [view, setView] = useState<'add' | 'list'>('add');

  // Pestañas: «Añadir» (escribir o elegir sugerencias) y «Mis palabras» (la lista)
  const tabs = (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 4 }}>
      {([['add', 'Añadir'], ['list', `Mis palabras${mine.length ? ` · ${mine.length}` : ''}`]] as const).map(([k, l]) => (
        <Pressable key={k} onPress={() => setView(k)} accessibilityRole="tab" accessibilityState={{ selected: view === k }}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: view === k ? t.ink : 'transparent' }}>
          <Text style={{ color: view === k ? t.bg : t.muted, fontWeight: '800', fontSize: 15 }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (view === 'add') {
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        {tabs}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={term} onChangeText={setTerm} placeholder={LANGS[lang].placeholder} placeholderTextColor={t.muted}
              autoCapitalize="none" autoCorrect={false} spellCheck={false} returnKeyType="done" onSubmitEditing={() => save(term)}
              style={{ flex: 1, minWidth: 0, backgroundColor: t.card, borderWidth: 2, borderColor: typing ? t.ink : t.line, borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 15, fontSize: 18, color: t.ink }} />
            {typing && <Btn title="+" kind="accent" onPress={() => save(term)} style={{ width: 56, borderRadius: 16 }} />}
          </View>
          {typing && sugg.list.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {sugg.fuzzy && <Text style={{ color: t.muted, width: '100%', fontSize: 13 }}>¿Querías decir…?</Text>}
              {sugg.list.map((w, i) => {
                const has = saved.has(norm(w));
                return (
                  <Pressable key={w} disabled={has} onPress={() => save(w)} accessibilityRole="button" accessibilityLabel={has ? `${w}, ya guardada` : `Guardar ${w}`}
                    style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1,
                      borderColor: i === 0 && !has ? t.ink : t.line, backgroundColor: pressed ? t.line : t.card, opacity: has ? 0.45 : 1 })}>
                    <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{cap(w)}{has ? ' ✓' : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {!typing && flash && <Text style={{ color: flash.bad ? t.bad : t.good, fontWeight: '700' }}>{flash.text}</Text>}
        </View>
        {!typing && !loading && <Suggestions lang={lang} saved={saved} count={mine.length} onSave={save} onPlay={onPlay} />}
      </ScrollView>
    );
  }

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      {tabs}
      {due > 0 && (
        <Pressable onPress={onPlay} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.accent, borderRadius: 14, padding: 14, opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: t.accentInk, fontWeight: '800', fontSize: 16, flex: 1 }}>{due} {due === 1 ? 'palabra' : 'palabras'} por repasar</Text>
          <Text style={{ color: t.accentInk, fontWeight: '800' }}>Jugar →</Text>
        </Pressable>
      )}
      {mine.length > 8 && (
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar en tus palabras…" placeholderTextColor={t.muted} autoCapitalize="none"
          style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: t.ink }} />
      )}
    </View>
  );

  return (
    <FlatList
      data={shown}
      keyExtractor={(w) => w.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.line }} />}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={loading ? <ActivityIndicator color={t.muted} style={{ marginTop: 30 }} /> : mine.length ? (
        <Text style={{ color: t.muted, paddingVertical: 10 }}>Ninguna palabra coincide.</Text>
      ) : (
        <Text style={{ color: t.muted, paddingVertical: 10 }}>
          Aún no tienes palabras. <Text onPress={() => setView('add')} style={{ color: t.blue, fontWeight: '800' }}>Añade la primera</Text>
        </Text>
      )}
      renderItem={({ item }) => (
        <WordRow w={item} open={openId === item.id} confirming={confirmId === item.id}
          onToggle={() => { setOpenId(openId === item.id ? null : item.id); setConfirmId(null); }}
          onDelete={() => { if (confirmId === item.id) { setConfirmId(null); setOpenId(null); removeWord(item.id); } else setConfirmId(item.id); }}
          onRetry={() => retryTranslate(item)} onArchive={() => patchWord(item.id, { archived: !item.archived })} />
      )}
    />
  );
}

/** Única recomendación: «Para ti» (según tus palabras) o por tema. 6 cada vez, sin repetir las que ya tienes. */
const FOR_YOU = 'parati';
function Suggestions({ lang, saved, count, onSave, onPlay }: { lang: Lang; saved: Set<string>; count: number; onSave: (t: string) => Promise<string>; onPlay: () => void }) {
  const t = useTheme();
  const { profile } = useStore();
  const more = count > 0;
  const personal = count >= 3; // con pocas palabras aún no hay base para recomendar
  const [topic, setTopic] = useState<string>(personal ? FOR_YOU : TOPICS[0].v);
  const [pool, setPool] = useState<Sugg[]>([]);       // todas las palabras recibidas de este tema
  const [nextPage, setNextPage] = useState(1);
  const [done, setDone] = useState(false);             // el servidor ya no da más páginas
  const [fetching, setFetching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set()); // las que pasaste con «Otras 6»
  const [addedHere, setAddedHere] = useState<Set<string>>(new Set()); // añadidas aquí: se quedan con ✓
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const gen = useRef(0); // cambia con el tema: descarta respuestas de un tema anterior

  const [ready, setReady] = useState(false);           // ya se han leído las que viste otros días
  const seenKey = `wz-vistas-${lang}-${profile.level}-${topic}`;

  // Al cambiar de tema, idioma o nivel se empieza de cero, recordando las que ya pasaste con «Otras 6»
  useEffect(() => {
    gen.current++;
    const g = gen.current;
    setPool([]); setNextPage(1); setDone(false); setFailed(false); setSkipped(new Set()); setAddedHere(new Set()); setReady(false);
    AsyncStorage.getItem(seenKey)
      .then((v) => { if (g === gen.current && v) setSkipped(new Set(JSON.parse(v))); })
      .catch(() => {})
      .finally(() => { if (g === gen.current) setReady(true); });
  }, [seenKey]);

  const visible = pool
    .filter((w) => !skipped.has(norm(w.term)) && (!saved.has(norm(w.term)) || addedHere.has(norm(w.term))))
    .slice(0, 6);
  const exhausted = done || nextPage > 10;

  // Pide más páginas (24 palabras cada una) hasta tener 6 que aún no tienes ni has pasado
  useEffect(() => {
    if (!ready || visible.length >= 6 || exhausted || failed || inflight.current) return;
    inflight.current = true;
    setFetching(true);
    const g = gen.current;
    // «Para ti»: 9 palabras por semana calculadas en el servidor (una sola página). Temas: páginas de 24.
    const call = topic === FOR_YOU
      ? supabase.functions.invoke('suggest', { body: { lang } }).then(({ data, error }) => ({ error, list: data?.items }))
      : supabase.functions.invoke('starter', { body: { lang, level: profile.level, topic, page: nextPage } }).then(({ data, error }) => ({ error, list: data?.words }));
    call.then(({ error, list }) => {
      inflight.current = false;
      setFetching(false);
      if (g !== gen.current) return;
      if (error || !Array.isArray(list)) { if (nextPage === 1) setFailed(true); else setDone(true); return; }
      if (!list.length) { setDone(true); return; }
      setPool((p) => {
        const have = new Set(p.map((w) => norm(w.term)));
        return [...p, ...(topic === FOR_YOU ? list as Sugg[] : shuffle(list as Sugg[])).filter((w) => !have.has(norm(w.term)))];
      });
      if (topic === FOR_YOU) setDone(true); else setNextPage((n) => n + 1);
    });
  }, [ready, visible.length, exhausted, fetching, failed, nextPage, lang, topic, profile.level]);

  // Si ya no hay más palabras nuevas pero quedan algunas que pasaste, se vuelven a ofrecer
  const leftover = pool.filter((w) => skipped.has(norm(w.term)) && !saved.has(norm(w.term)));
  useEffect(() => {
    if (ready && exhausted && !fetching && visible.length === 0 && leftover.length > 0) saveSkipped(new Set());
  }, [ready, exhausted, fetching, visible.length, leftover.length]);

  const saveSkipped = (n: Set<string>) => {
    setSkipped(n);
    AsyncStorage.setItem(seenKey, JSON.stringify([...n].slice(-400))).catch(() => {});
  };

  const add = async (term: string) => {
    setAddedHere((s) => new Set(s).add(norm(term)));
    return onSave(term);
  };
  const missing = visible.filter((w) => !saved.has(norm(w.term)));
  const addAll = async () => {
    setBusy(true);
    for (const w of missing) { const r = await add(w.term); if (r === 'limit') break; }
    setBusy(false);
    onPlay();
  };
  const otherSix = () => { const n = new Set(skipped); visible.forEach((w) => n.add(norm(w.term))); saveSkipped(n); };
  const loadingFirst = !visible.length && !failed && (!exhausted || leftover.length > 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 18 }}>{more ? 'Sugerencias' : '¿No se te ocurre ninguna?'}</Text>
        <Text style={{ color: t.muted }}>{more ? 'Añade las que quieras:' : 'Empieza con estas. Elige un tema:'}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {personal && <Chip label="Para ti" on={topic === FOR_YOU} onPress={() => setTopic(FOR_YOU)} />}
        {TOPICS.map((x) => <Chip key={x.v} label={x.l} on={topic === x.v} onPress={() => setTopic(x.v)} />)}
      </View>
      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 }}>
        {loadingFirst && <ActivityIndicator color={t.muted} style={{ paddingVertical: 30 }} />}
        {failed && <Text style={{ color: t.muted, paddingVertical: 20 }}>No se pudieron cargar las sugerencias. Escribe tú una palabra arriba.</Text>}
        {!visible.length && !failed && exhausted && !leftover.length && (
          <Text style={{ color: t.muted, paddingVertical: 20 }}>{topic === FOR_YOU ? 'Ya has visto las sugerencias de esta semana. Prueba con un tema.' : 'Ya tienes todas las palabras de este tema. Prueba con otro.'}</Text>
        )}
        {visible.map((w, i) => {
          const has = saved.has(norm(w.term));
          return (
            <View key={w.term} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{cap(w.term)}</Text>
                <Text style={{ color: t.muted, fontSize: 14 }} numberOfLines={1}>{cap(w.translation)}</Text>
              </View>
              <Speaker onPress={() => say(w.term, lang)} />
              <Pressable onPress={() => !has && add(w.term)} disabled={has} accessibilityRole="button" accessibilityLabel={has ? 'Añadida' : `Añadir ${w.term}`}
                style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? t.goodSoft : t.accent }}>
                <Text style={{ color: has ? t.good : t.accentInk, fontWeight: '800', fontSize: 17 }}>{has ? '✓' : '+'}</Text>
              </Pressable>
            </View>
          );
        })}
        {fetching && visible.length > 0 && visible.length < 6 && <ActivityIndicator color={t.muted} style={{ paddingVertical: 10 }} />}
      </View>
      {visible.length > 0 && (
        <>
          <Btn big kind="accent" title={busy ? 'Añadiendo…' : missing.length ? (more ? `Añadir las ${missing.length} y jugar` : 'Añadir las que faltan y jugar') : 'Jugar'} onPress={missing.length ? addAll : onPlay} disabled={busy} />
          {!exhausted || pool.some((w) => !saved.has(norm(w.term)) && !visible.includes(w)) ? (
            <Text onPress={otherSix} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', textAlign: 'center' }}>Otras 6 ›</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function WordRow({ w, open, confirming, onToggle, onDelete, onRetry, onArchive }: {
  w: Word; open: boolean; confirming: boolean; onToggle: () => void; onDelete: () => void; onRetry: () => void; onArchive: () => void;
}) {
  const t = useTheme();
  const meaning = w.status === 'pending' ? 'Traduciendo…' : w.status === 'error' ? 'Sin traducción' : cap(w.meaning);
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ paddingVertical: 13, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '800' }}>{cap(w.term)}</Text>
          <Text style={{ color: w.status === 'ok' ? t.ink : t.muted, fontSize: 15, opacity: w.status === 'ok' ? 0.8 : 1 }} numberOfLines={open ? undefined : 1}>{meaning}</Text>
        </View>
        {w.archived ? <Badge text="FUERA DEL JUEGO" bg={t.line} fg={t.muted} />
          : w.box === 5 ? <Badge text="DOMINADA" bg={t.accent} fg={t.accentInk} />
          : isHard(w) ? <Badge text="TE CUESTA" bg={t.badSoft} fg={t.bad} />
          : <View style={{ flexDirection: 'row', gap: 3 }}>{[1, 2, 3, 4, 5].map((i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i <= w.box ? t.accent : t.line }} />)}</View>}
      </View>
      {open && (
        <View style={{ gap: 8 }}>
          {w.status === 'error' && <Text style={{ color: t.muted }}>{w.note} <Text onPress={onRetry} style={{ color: t.blue, fontWeight: '700' }}>Reintentar</Text></Text>}
          {w.status === 'ok' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Speaker onPress={() => say(w.term, w.deck)} label={`Escuchar ${w.term}`} />
              <Text style={{ color: t.muted, fontSize: 13 }}>Escuchar</Text>
            </View>
          )}
          {w.alts.length > 0 && <Text style={{ color: t.muted }}>También: {capList(w.alts)}</Text>}
          {w.status === 'ok' && !!w.note && <Text style={{ color: t.bad }}>{w.note}</Text>}
          {(w.examples?.length ? w.examples : w.example ? [{ text: w.example, translation: '' }] : []).map((ex) => (
            <View key={ex.text} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', borderLeftWidth: 3, borderColor: t.accent, paddingLeft: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink }}>{ex.text}</Text>
                {!!ex.translation && <Text style={{ color: t.muted, fontSize: 13 }}>{ex.translation}</Text>}
              </View>
              <Speaker size={24} onPress={() => say(ex.text, w.deck)} label="Escuchar la frase" />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
            {w.status === 'ok' && (
              <Text onPress={onArchive} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', paddingVertical: 4 }}>
                {w.archived ? 'Volver a jugar con ella' : 'Sacar del juego'}
              </Text>
            )}
            <Text onPress={onDelete} accessibilityRole="button" style={{ color: t.bad, fontWeight: confirming ? '800' : '600', paddingVertical: 4 }}>
              {confirming ? 'Toca otra vez para borrar' : 'Borrar palabra'}
            </Text>
          </View>
          {w.archived && <Text style={{ color: t.muted, fontSize: 13 }}>No te la preguntaremos en los juegos. Sigue en tu lista.</Text>}
        </View>
      )}
    </Pressable>
  );
}

const Badge = ({ text, bg, fg }: { text: string; bg: string; fg: string }) => (
  <Text style={{ color: fg, backgroundColor: bg, fontWeight: '800', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>{text}</Text>
);
