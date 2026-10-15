import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { siteOrigin } from '../lib/links';
import { SITE_URL } from '../lib/config';
import { LANGS } from '../lib/langs';
import type { Challenge } from '../lib/types';
import { Btn, Card, Label } from '../components/ui';

type Row = { user_id: string; name: string; week_xp: number; is_me: boolean };
const COLORS = ['#7C5CFF', '#1E8A55', '#F06A1D', '#2F5BD3', '#C2383A', '#0E8C8C'];
const hoursLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));

export default function FriendsScreen({ onPlayChallenge }: { onPlayChallenge: (id: string) => void }) {
  const t = useTheme();
  const { profile, stats, lang, updateProfile } = useStore();
  const [league, setLeague] = useState<Row[] | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: l }, { data: c }] = await Promise.all([supabase.rpc('league'), supabase.rpc('my_challenges')]);
    setLeague((l as Row[]) || []);
    setChallenges((c as Challenge[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const share = async (url: string, text: string) => {
    setLink(url);
    try {
      await Share.share(Platform.OS === 'web' ? { message: `${text} ${url}`, url } : { message: `${text} ${url}` });
    } catch {
      try { await navigator.clipboard.writeText(url); setNote('Enlace copiado. Pégalo en WhatsApp o Instagram.'); }
      catch { setNote('Copia el enlace de abajo y envíaselo.'); }
    }
  };

  const challenge = async () => {
    setNote(null);
    const target = Math.max(stats.best_round, 100);
    const { data, error } = await supabase.from('challenges').insert({ target_xp: target, lang }).select('id').single();
    if (error || !data) return setNote('No se pudo crear el reto. Inténtalo de nuevo.');
    share(`${siteOrigin(SITE_URL)}/?reto=${data.id}&amigo=${profile.friend_code}`, `Te reto en Wordazo: supera ${target} XP en ${LANGS[lang].name}.`);
  };
  const invite = () => share(`${siteOrigin(SITE_URL)}/?amigo=${profile.friend_code}`, 'Aprende idiomas conmigo en Wordazo:');

  const play = async (c: Challenge) => {
    if (c.lang !== lang) await updateProfile({ current_lang: c.lang, langs: profile.langs.includes(c.lang) ? profile.langs : [...profile.langs, c.lang] });
    onPlayChallenge(c.id);
  };
  const removeFriend = async (id: string) => {
    if (confirm !== id) return setConfirm(id);
    setConfirm(null);
    await supabase.rpc('remove_friend', { p_friend: id });
    load();
  };

  const now = Date.now();
  const toPlay = challenges.filter((c) => !c.mine && c.status === 'accepted' && new Date(c.expires_at).getTime() > now);
  const results = challenges.filter((c) => c.status === 'won' || c.status === 'lost').slice(0, 5);
  const friends = (league || []).filter((r) => !r.is_me);
  const meIdx = (league || []).findIndex((r) => r.is_me);
  const ahead = meIdx > 0 ? league![meIdx - 1] : null;
  const me = meIdx >= 0 ? league![meIdx] : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Amigos</Text>

      {toPlay.map((c) => (
        <View key={c.id} style={{ backgroundColor: t.accent, borderRadius: 18, padding: 14, gap: 8 }}>
          <Label style={{ color: t.accentInk }}>Reto pendiente · {LANGS[c.lang].name}</Label>
          <Text style={{ color: t.accentInk, fontSize: 18, fontWeight: '800' }}>{c.other_name} te reta: supera {c.target_xp} XP en Elige</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Btn title="Jugar el reto" onPress={() => play(c)} style={{ flex: 1, backgroundColor: t.accentInk }} />
            <Text style={{ color: t.accentInk, fontWeight: '700' }}>Quedan {hoursLeft(c.expires_at)} h</Text>
          </View>
        </View>
      ))}

      {results.map((c) => {
        const iWon = (c.mine && c.status === 'lost') || (!c.mine && c.status === 'won');
        const txt = c.mine
          ? c.status === 'won' ? `${c.other_name} superó tus ${c.target_xp} XP con ${c.result_xp}` : `${c.other_name} no llegó a tus ${c.target_xp} XP (${c.result_xp})`
          : c.status === 'won' ? `Superaste el reto de ${c.other_name}: ${c.result_xp} XP` : `No superaste el reto de ${c.other_name} (${c.result_xp} de ${c.target_xp} XP)`;
        return (
          <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: iWon ? t.goodSoft : t.badSoft, borderRadius: 14, padding: 12 }}>
            <Text style={{ fontSize: 18 }}>{iWon ? '🏆' : '💪'}</Text>
            <Text style={{ flex: 1, color: t.ink }}>{txt}</Text>
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 17 }}>Liga de la semana</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>Termina el domingo</Text>
      </View>
      {!league ? <ActivityIndicator color={t.muted} /> : friends.length === 0 ? (
        <Card style={{ gap: 6, alignItems: 'center' }}>
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>Aún no tienes amigos aquí</Text>
          <Text style={{ color: t.muted, textAlign: 'center' }}>Reta a alguien o invítale con tu enlace. Cuando lo abra, apareceréis en la liga del otro.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {league.map((r, k) => (
            <View key={r.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: k ? 1 : 0, borderColor: t.line,
              backgroundColor: r.is_me ? t.bg : 'transparent', marginHorizontal: r.is_me ? -16 : 0, paddingHorizontal: r.is_me ? 16 : 0 }}>
              <Text style={{ width: 16, color: t.muted, fontWeight: '800' }}>{k + 1}</Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: r.is_me ? t.ink : COLORS[k % COLORS.length] }}>
                <Text style={{ color: r.is_me ? t.bg : '#fff', fontWeight: '800' }}>{(r.is_me ? 'Tú' : r.name)[0]}</Text>
              </View>
              <Text style={{ flex: 1, color: t.ink, fontWeight: '700' }}>{r.is_me ? 'Tú' : r.name}</Text>
              <Text style={{ color: t.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{r.week_xp.toLocaleString('es-ES')} XP</Text>
              {!r.is_me && (
                <Text onPress={() => removeFriend(r.user_id)} accessibilityRole="button" style={{ color: confirm === r.user_id ? t.bad : t.muted, fontSize: 12, fontWeight: '700', paddingLeft: 4 }}>
                  {confirm === r.user_id ? '¿Quitar?' : 'Quitar'}
                </Text>
              )}
            </View>
          ))}
        </Card>
      )}
      {ahead && me && <Text style={{ color: t.good, fontWeight: '700' }}>Te faltan {ahead.week_xp - me.week_xp + 1} XP para pasar a {ahead.name}</Text>}

      <Btn big kind="accent" title="Retar a un amigo" onPress={challenge} />
      <Btn kind="ghost" title="Invitar con mi enlace" onPress={invite} />
      {note && <Text style={{ color: t.muted, textAlign: 'center' }}>{note}</Text>}
      {link && <Text selectable style={{ color: t.blue, textAlign: 'center', fontSize: 13 }}>{link}</Text>}
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>Tus amigos solo ven tu nombre de pila y tus puntos de la semana. No hay chat.</Text>
    </ScrollView>
  );
}
