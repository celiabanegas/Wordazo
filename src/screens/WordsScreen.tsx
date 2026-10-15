import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { suggest } from '../lib/suggest';
import { norm } from '../lib/text';
import { isDue } from '../lib/progress';
import { say } from '../lib/speech';
import { supabase } from '../lib/supabase';
import { LANGS, TOPICS, type Lang } from '../lib/langs';
import { isHard, type Word } from '../lib/types';
import { DAILY_WORD_LIMIT } from '../lib/config';
import { Btn, Chip, Speaker } from '../components/ui';

type Sugg = { term: string; translation: string; reason?: string };
const mondayUTC = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export default function WordsScreen({ onPlay }: { onPlay: () => void }) {
  const t = useTheme();
  const { words, addWord, removeWord, retryTranslate, loading, lang } = useStore();
  const [term, setTerm] = useState('');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
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
  const due = mine.filter((w) => w.status === 'ok' && isDue(w)).length;

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

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
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
                  <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{w}{has ? ' ✓' : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {!typing && flash && <Text style={{ color: flash.bad ? t.bad : t.good, fontWeight: '700' }}>{flash.text}</Text>}
      </View>

      {!typing && !loading && mine.length === 0 && <Starter lang={lang} saved={saved} onSave={save} onPlay={onPlay} />}

      {!typing && mine.length > 0 && (
        <>
          {due > 0 && (
            <Pressable onPress={onPlay} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.accent, borderRadius: 14, padding: 14, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ color: t.accentInk, fontWeight: '800', fontSize: 16, flex: 1 }}>{due} {due === 1 ? 'palabra' : 'palabras'} por repasar</Text>
              <Text style={{ color: t.accentInk, fontWeight: '800' }}>Jugar →</Text>
            </Pressable>
          )}
          <ForYou lang={lang} count={mine.length} onSave={save} />
          <Starter lang={lang} saved={saved} onSave={save} onPlay={onPlay} more />
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
            {searching ? (
              <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Buscar…" placeholderTextColor={t.muted} autoCapitalize="none"
                style={{ flex: 1, fontSize: 16, color: t.ink, paddingVertical: 6, borderBottomWidth: 1, borderColor: t.line }} />
            ) : (
              <Text style={{ flex: 1, color: t.ink, fontWeight: '800', fontSize: 16 }}>Tus palabras <Text style={{ color: t.muted, fontWeight: '600' }}>{mine.length}</Text></Text>
            )}
            {mine.length > 8 && (
              <Text onPress={() => { setSearching(!searching); setQ(''); }} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', paddingLeft: 12, paddingVertical: 6 }}>
                {searching ? 'Cerrar' : 'Buscar'}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );

  return (
    <FlatList
      data={typing ? [] : shown}
      keyExtractor={(w) => w.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.line }} />}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={loading ? <ActivityIndicator color={t.muted} style={{ marginTop: 30 }} /> : mine.length && !typing ? (
        <Text style={{ color: t.muted, paddingVertical: 10 }}>Ninguna palabra coincide.</Text>
      ) : null}
      renderItem={({ item }) => (
        <WordRow w={item} open={openId === item.id} confirming={confirmId === item.id}
          onToggle={() => { setOpenId(openId === item.id ? null : item.id); setConfirmId(null); }}
          onDelete={() => { if (confirmId === item.id) { setConfirmId(null); setOpenId(null); removeWord(item.id); } else setConfirmId(item.id); }}
          onRetry={() => retryTranslate(item)} />
      )}
    />
  );
}

/** Primeras palabras: 6 por tema cuando aún no tienes ninguna */
function Starter({ lang, saved, onSave, onPlay, more }: { lang: Lang; saved: Set<string>; onSave: (t: string) => Promise<string>; onPlay: () => void; more?: boolean }) {
  const t = useTheme();
  const { profile } = useStore();
  const [topic, setTopic] = useState<string>(TOPICS[0].v);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Sugg[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setItems(null); setFailed(false);
    supabase.functions.invoke('starter', { body: { lang, level: profile.level, topic, page } }).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data?.words) setFailed(true); else setItems(data.words);
    });
    return () => { alive = false; };
  }, [lang, topic, page, profile.level]);

  const missing = (items || []).filter((w) => !saved.has(norm(w.term)));
  const addAll = async () => {
    setBusy(true);
    for (const w of missing) { const r = await onSave(w.term); if (r === 'limit') break; }
    setBusy(false);
    onPlay();
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: more ? 16 : 18 }}>{more ? 'Descubre palabras por tema' : '¿No se te ocurre ninguna?'}</Text>
        <Text style={{ color: t.muted }}>{more ? 'Elige un tema y añade las que quieras:' : 'Empieza con estas. Elige un tema:'}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TOPICS.map((x) => <Chip key={x.v} label={x.l} on={topic === x.v} onPress={() => { setTopic(x.v); setPage(1); }} />)}
      </View>
      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 }}>
        {!items && !failed && <ActivityIndicator color={t.muted} style={{ paddingVertical: 30 }} />}
        {failed && <Text style={{ color: t.muted, paddingVertical: 20 }}>No se pudieron cargar las sugerencias. Escribe tú una palabra arriba.</Text>}
        {items?.map((w, i) => {
          const has = saved.has(norm(w.term));
          return (
            <View key={w.term} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{w.term}</Text>
                <Text style={{ color: t.muted, fontSize: 14 }} numberOfLines={1}>{w.translation}</Text>
              </View>
              <Speaker onPress={() => say(w.term, lang)} />
              <Pressable onPress={() => !has && onSave(w.term)} disabled={has} accessibilityRole="button" accessibilityLabel={has ? 'Añadida' : `Añadir ${w.term}`}
                style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? t.goodSoft : t.accent }}>
                <Text style={{ color: has ? t.good : t.accentInk, fontWeight: '800', fontSize: 17 }}>{has ? '✓' : '+'}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      {!!items?.length && (
        <>
          <Btn big kind="accent" title={busy ? 'Añadiendo…' : missing.length ? (more ? `Añadir las ${missing.length} y jugar` : 'Añadir las que faltan y jugar') : 'Jugar'} onPress={missing.length ? addAll : onPlay} disabled={busy} />
          <Text onPress={() => setPage(page + 1)} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', textAlign: 'center' }}>Otras 6 ›</Text>
        </>
      )}
    </View>
  );
}

/** Sugerencias «Para ti»: se calculan una vez por semana en el servidor */
function ForYou({ lang, count, onSave }: { lang: Lang; count: number; onSave: (t: string) => Promise<string> }) {
  const t = useTheme();
  const { session } = useStore();
  const [items, setItems] = useState<Sugg[]>([]);
  const [show, setShow] = useState(3);

  useEffect(() => {
    let alive = true;
    setItems([]); setShow(3);
    if (count < 3) return;
    supabase.functions.invoke('suggest', { body: { lang } }).then(({ data }) => { if (alive && Array.isArray(data?.items)) setItems(data.items); });
    return () => { alive = false; };
  }, [lang, count >= 3]); // eslint-disable-line react-hooks/exhaustive-deps

  const drop = (term: string) => {
    const next = items.filter((i) => i.term !== term);
    setItems(next);
    supabase.from('user_suggestions').update({ items: next }).eq('user_id', session.user.id).eq('lang', lang).eq('week', mondayUTC()).then(() => null);
  };

  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>Para ti</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>Según tus palabras y tu nivel</Text>
      </View>
      {items.slice(0, show).map((s) => (
        <View key={s.term} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{s.term}</Text>
            <Text style={{ color: t.ink, fontSize: 14 }}>{s.translation}</Text>
            {!!s.reason && <Text style={{ color: t.muted, fontSize: 12 }}>{s.reason}</Text>}
          </View>
          <Pressable onPress={() => { onSave(s.term); drop(s.term); }} accessibilityRole="button" accessibilityLabel={`Añadir ${s.term}`}
            style={{ backgroundColor: t.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }}>
            <Text style={{ color: t.accentInk, fontWeight: '800' }}>+ Añadir</Text>
          </Pressable>
          <Pressable onPress={() => drop(s.term)} accessibilityRole="button" accessibilityLabel={`Descartar ${s.term}`} hitSlop={8}>
            <Text style={{ color: t.muted, fontSize: 16, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
      ))}
      {items.length > show && (
        <Text onPress={() => setShow(show + 3)} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', textAlign: 'center', paddingVertical: 4 }}>Ver más sugerencias</Text>
      )}
    </View>
  );
}

function WordRow({ w, open, confirming, onToggle, onDelete, onRetry }: {
  w: Word; open: boolean; confirming: boolean; onToggle: () => void; onDelete: () => void; onRetry: () => void;
}) {
  const t = useTheme();
  const meaning = w.status === 'pending' ? 'Traduciendo…' : w.status === 'error' ? 'Sin traducción' : w.meaning;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ paddingVertical: 13, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '800' }}>{w.term}</Text>
          <Text style={{ color: w.status === 'ok' ? t.ink : t.muted, fontSize: 15, opacity: w.status === 'ok' ? 0.8 : 1 }} numberOfLines={open ? undefined : 1}>{meaning}</Text>
        </View>
        {w.box === 5 ? <Badge text="DOMINADA" bg={t.accent} fg={t.accentInk} />
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
          {w.alts.length > 0 && <Text style={{ color: t.muted }}>También: {w.alts.join(', ')}</Text>}
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
          <Text onPress={onDelete} accessibilityRole="button" style={{ color: t.bad, fontWeight: confirming ? '800' : '600', alignSelf: 'flex-start', paddingVertical: 4 }}>
            {confirming ? 'Toca otra vez para borrar' : 'Borrar palabra'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const Badge = ({ text, bg, fg }: { text: string; bg: string; fg: string }) => (
  <Text style={{ color: fg, backgroundColor: bg, fontWeight: '800', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>{text}</Text>
);
