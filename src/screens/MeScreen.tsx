import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { openIntro } from '../components/Intro';
import { supabase } from '../lib/supabase';
import { LANGS } from '../lib/langs';
import { liveStreak } from '../lib/progress';
import { cap, todayStr } from '../lib/text';
import { enablePush, disablePush, pushSupported } from '../lib/push';
import type { Challenge } from '../lib/types';
import { Btn, Label } from '../components/ui';
import Sheet from '../components/Sheet';
import InstallBanner from '../components/InstallBanner';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function MeScreen() {
  const t = useTheme();
  const { profile, words, stats, xpDays, lang } = useStore();
  const [settings, setSettings] = useState(false);
  const [wins, setWins] = useState(0);
  const [allStickers, setAllStickers] = useState(false);

  useEffect(() => {
    supabase.rpc('my_challenges').then(({ data }) => {
      setWins(((data as Challenge[]) || []).filter((c) => (!c.mine && c.status === 'won') || (c.mine && c.status === 'lost')).length);
    });
  }, []);

  const mine = words.filter((w) => w.deck === lang);
  const mastered = mine.filter((w) => w.box === 5).length;
  const hardest = [...mine].sort((a, b) => b.fails - a.fails)[0];
  const allWords = words.length;
  const allMastered = words.filter((w) => w.box === 5).length;
  const streak = liveStreak(stats);
  const since = new Date(profile.created_at);

  // Calendario del mes actual
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const today = now.getDate();

  const stickers = useMemo(() => [
    { k: 'r3', big: '3', unit: 'días', have: stats.best_streak, need: 3 },
    { k: 'r7', big: '7', unit: 'días', have: stats.best_streak, need: 7 },
    { k: 'w10', big: '10', unit: 'palabras', have: allWords, need: 10 },
    { k: 'c4', big: '×4', unit: 'combo', have: stats.best_combo >= 9 ? 1 : 0, need: 1 },
    { k: 'p1', big: '0', unit: 'fallos', have: stats.perfect_rounds, need: 1 },
    { k: 'f1', big: '1', unit: 'reto', have: wins, need: 1 },
    { k: 'w50', big: '50', unit: 'palabras', have: allWords, need: 50 },
    { k: 'm10', big: '10', unit: 'dominadas', have: allMastered, need: 10 },
    { k: 'r30', big: '30', unit: 'días', have: stats.best_streak, need: 30 },
    { k: 'p10', big: '10', unit: 'perfectas', have: stats.perfect_rounds, need: 10 },
    { k: 'f5', big: '5', unit: 'retos', have: wins, need: 5 },
    { k: 'w200', big: '200', unit: 'palabras', have: allWords, need: 200 },
    { k: 'm50', big: '50', unit: 'dominadas', have: allMastered, need: 50 },
    { k: 'r100', big: '100', unit: 'días', have: stats.best_streak, need: 100 },
  ], [stats, allWords, allMastered, wins]);
  const earned = stickers.filter((s) => s.have >= s.need);
  const locked = stickers.filter((s) => s.have < s.need);
  const shown = allStickers ? [...earned, ...locked] : [...earned.slice(-4), ...locked.slice(0, 1)];
  const palette = [t.fire, t.blue, t.accent, t.good];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}>{profile.display_name.split(' ')[0] || 'Tú'}</Text>
            {!!profile.username && <Text style={{ color: t.ink, fontWeight: '700' }}>@{profile.username}</Text>}
            <Text style={{ color: t.muted }}>Aprende {LANGS[lang].name.toLowerCase()} desde el {since.getDate()} de {MONTHS[since.getMonth()]}</Text>
          </View>
          <Pressable onPress={() => setSettings(true)} accessibilityRole="button" accessibilityLabel="Ajustes"
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.muted, fontSize: 18 }}>⚙</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16, textTransform: 'capitalize' }}>{MONTHS[now.getMonth()]}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              <Text style={{ color: streak ? t.fire : t.muted, fontWeight: '800' }}>{streak} {streak === 1 ? 'día seguido' : 'días seguidos'}</Text> · récord {stats.best_streak}
            </Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <Text key={d} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 11, fontWeight: '700' }}>{d}</Text>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: lead }).map((_, k) => <View key={'e' + k} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />)}
            {Array.from({ length: daysIn }).map((_, k) => {
              const d = k + 1;
              const played = (xpDays[todayStr(new Date(now.getFullYear(), now.getMonth(), d))] || 0) > 0;
              const future = d > today;
              return (
                <View key={d} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                  <View style={{ flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: played ? t.accent : future ? 'transparent' : t.bg,
                    borderWidth: d === today ? 2 : 0, borderColor: t.ink }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: played ? t.accentInk : future ? t.line : t.muted, fontVariant: ['tabular-nums'] }}>{d}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={{ color: t.ink, fontSize: 16, lineHeight: 24 }}>
          {mine.length === 0 ? `Aún no has guardado palabras de ${LANGS[lang].name.toLowerCase()}. ¡La primera es la más fácil!` : (
            <>
              Has guardado <Text style={{ fontWeight: '800' }}>{mine.length} {mine.length === 1 ? 'palabra' : 'palabras'}</Text>
              {mastered > 0 ? <> y ya dominas <Text style={{ fontWeight: '800' }}>{mastered}</Text></> : null}.
              {hardest && hardest.fails >= 2 ? (
                <> La que más se te resiste es <Text style={{ fontWeight: '800', color: t.bad, backgroundColor: t.badSoft }}> {cap(hardest.term)} </Text>: la has fallado {hardest.fails} veces.</>
              ) : null}
            </>
          )}
        </Text>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>Pegatinas</Text>
            <Text onPress={() => setAllStickers(!allStickers)} accessibilityRole="button" style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>
              {earned.length} de {stickers.length} {allStickers ? '‹' : '›'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 4 }}>
            {shown.map((s, k) => {
              const got = s.have >= s.need;
              const c = palette[k % palette.length];
              const ink = c === t.accent ? t.accentInk : '#fff';
              return (
                <View key={s.k} accessibilityLabel={`${s.big} ${s.unit}${got ? '' : `, ${Math.min(s.have, s.need)} de ${s.need}`}`}
                  style={{ width: 60, height: 60, borderRadius: k % 2 ? 16 : 30, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: got ? c : 'transparent', borderWidth: got ? 0 : 2, borderStyle: 'dashed', borderColor: t.line,
                    transform: [{ rotate: got ? `${[-8, 5, -3, 9, -6][k % 5]}deg` : '0deg' }] }}>
                  <Text style={{ color: got ? ink : t.muted, fontWeight: '800', fontSize: 18 }}>{s.big}</Text>
                  <Text style={{ color: got ? ink : t.muted, fontWeight: '800', fontSize: 9, textTransform: 'uppercase' }}>{got ? s.unit : `${Math.min(s.have, s.need)}/${s.need}`}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </View>
  );
}

const GOALS = [{ v: 30, l: 'Suave' }, { v: 60, l: 'Normal' }, { v: 120, l: 'Serio' }, { v: 200, l: 'Intenso' }];

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { session, profile, stats, setDailyGoal, updateProfile } = useStore();
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [del, setDel] = useState(0);

  const toggleReminder = async () => {
    setPushMsg(null);
    if (profile.reminder_on) { await disablePush(); await updateProfile({ reminder_on: false }); return; }
    const err = await enablePush();
    if (err) return setPushMsg(err);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || profile.tz;
    await updateProfile({ reminder_on: true, tz });
    setPushMsg('Listo. Te avisaremos como mucho una vez al día, y solo si aún no has jugado.');
  };
  const hour = (d: number) => updateProfile({ reminder_hour: (profile.reminder_hour + d + 24) % 24 });
  const deleteAccount = async () => {
    if (del < 1) return setDel(1);
    setDel(2);
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) { setDel(0); setPushMsg('No se pudo borrar la cuenta. Inténtalo de nuevo.'); return; }
    await supabase.auth.signOut();
  };

  return (
    <Sheet onClose={onClose}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: t.muted }}>Has entrado como</Text>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{session.user.email}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Label>Objetivo diario</Label>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {GOALS.map((g) => {
            const on = stats.daily_goal === g.v;
            return (
              <Pressable key={g.v} onPress={() => setDailyGoal(g.v)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.bg }}>
                <Text style={{ color: on ? t.bg : t.ink, fontWeight: '800' }}>{g.l}</Text>
                <Text style={{ color: on ? t.bg : t.muted, fontSize: 12 }}>{g.v} XP</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Label>Aviso diario</Label>
        {pushSupported() || profile.reminder_on ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={toggleReminder} accessibilityRole="switch" accessibilityState={{ checked: profile.reminder_on }}
              style={{ width: 52, height: 30, borderRadius: 15, padding: 3, backgroundColor: profile.reminder_on ? t.good : t.line, alignItems: profile.reminder_on ? 'flex-end' : 'flex-start' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' }} />
            </Pressable>
            <Text style={{ flex: 1, color: t.ink, fontWeight: '700' }}>{profile.reminder_on ? 'Activado' : 'Desactivado'}</Text>
            {profile.reminder_on && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Btn title="−" kind="ghost" onPress={() => hour(-1)} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
                <Text style={{ color: t.ink, fontWeight: '800', fontVariant: ['tabular-nums'], width: 52, textAlign: 'center' }}>{String(profile.reminder_hour).padStart(2, '0')}:00</Text>
                <Btn title="+" kind="ghost" onPress={() => hour(1)} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
              </View>
            )}
          </View>
        ) : (
          <Text style={{ color: t.muted }}>{Platform.OS === 'web' ? 'Este navegador no permite avisos. En iPhone, añade Wordazo a la pantalla de inicio y ábrela desde ahí.' : 'Los avisos llegarán en la versión de la app para tiendas.'}</Text>
        )}
        {pushMsg && <Text style={{ color: t.muted, fontSize: 13 }}>{pushMsg}</Text>}
      </View>

      <InstallBanner />

      <View style={{ gap: 4 }}>
        {Platform.OS === 'web' && (
          <Text onPress={() => window.open('/privacidad.html', '_blank')} accessibilityRole="link" style={{ color: t.ink, fontWeight: '700', paddingVertical: 10 }}>Política de privacidad ›</Text>
        )}
        <Text onPress={() => { onClose(); openIntro(); }} accessibilityRole="button" style={{ color: t.ink, fontWeight: '700', paddingVertical: 10 }}>Ver la introducción ›</Text>
        <Text onPress={() => supabase.auth.signOut()} accessibilityRole="button" style={{ color: t.ink, fontWeight: '700', paddingVertical: 10 }}>Cerrar sesión</Text>
        <Text onPress={deleteAccount} accessibilityRole="button" style={{ color: t.bad, fontWeight: del ? '800' : '700', paddingVertical: 10 }}>
          {del === 2 ? 'Borrando…' : del === 1 ? 'Toca otra vez para borrar tu cuenta y todas tus palabras' : 'Borrar mi cuenta'}
        </Text>
      </View>
      <Btn title="Listo" kind="ghost" onPress={onClose} />
    </Sheet>
  );
}
