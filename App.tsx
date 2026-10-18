import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { StoreProvider, useStore } from './src/lib/store';
import { useTheme } from './src/lib/theme';
import { LANGS } from './src/lib/langs';
import { ageFrom } from './src/lib/password';
import { readUrlParams, takePending } from './src/lib/links';
import type { Profile } from './src/lib/types';
import AuthScreen, { NewPasswordScreen } from './src/screens/AuthScreen';
import { CompleteProfileScreen, GuardianApproveScreen, GuardianScreen, LanguageScreen } from './src/screens/Onboarding';
import WordsScreen from './src/screens/WordsScreen';
import Intro, { useIntro } from './src/components/Intro';
import PlayScreen, { type Game } from './src/screens/PlayScreen';
import ChoiceGame from './src/screens/ChoiceGame';
import { CardsGame, WriteGame } from './src/screens/PracticeGames';
import FriendsScreen from './src/screens/FriendsScreen';
import MeScreen from './src/screens/MeScreen';
import LangSheet from './src/components/LangSheet';
import { Logo } from './src/components/ui';

const URL_PARAMS = readUrlParams();

export default function App() {
  const t = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [permiso, setPermiso] = useState(URL_PARAMS.permiso);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  let content: React.ReactNode;
  if (permiso) content = <GuardianApproveScreen token={permiso} onClose={() => setPermiso(undefined)} />;
  else if (session === undefined) content = <Center><ActivityIndicator color={t.muted} /></Center>;
  else if (recovery && session) content = <NewPasswordScreen onDone={() => setRecovery(false)} />;
  else if (!session) content = <AuthScreen />;
  else content = <Gate session={session} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>{content}</SafeAreaView>
    </SafeAreaProvider>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;

/** Comprueba perfil, edad, permiso y primeros ajustes antes de abrir la app */
function Gate({ session }: { session: Session }) {
  const t = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsent] = useState<'none' | 'pending' | 'approved'>('none');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    let { data: p, error } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    if (!p && !error) {
      const meta = session.user.user_metadata || {};
      const birth = typeof meta.birthdate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.birthdate) ? meta.birthdate : null;
      const first = String(meta.full_name || meta.name || '').trim().split(/\s+/).slice(0, 2).join(' ').slice(0, 30);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
      const uname = typeof meta.username === 'string' && /^[a-z0-9_.]{3,20}$/.test(meta.username) ? meta.username : null;
      ({ data: p, error } = await supabase.from('profiles').insert({ birthdate: birth, display_name: first, tz, username: uname }).select('*').single());
      // Si alguien cogió ese nombre de usuario justo antes, se crea sin él y se pide otro
      if (error?.code === '23505' && uname) ({ data: p, error } = await supabase.from('profiles').insert({ birthdate: birth, display_name: first, tz }).select('*').single());
    }
    if (error || !p) return setFailed(true);
    const { data: c } = await supabase.from('guardian_consents').select('status').maybeSingle();
    setConsent((c?.status as 'pending' | 'approved') || 'none');
    setProfile(p as Profile);
  }, [session.user.id, session.user.user_metadata]);

  useEffect(() => { load(); }, [load]);

  const patch = async (x: Partial<Profile>) => {
    const { data } = await supabase.from('profiles').update(x).eq('user_id', session.user.id).select('*').single();
    if (data) setProfile(data as Profile);
  };

  if (failed) return <Center><Text style={{ color: t.ink, marginBottom: 12 }}>No se pudo cargar tu cuenta.</Text><Text onPress={load} style={{ color: t.blue, fontWeight: '800' }}>Reintentar</Text></Center>;
  if (!profile) return <Center><ActivityIndicator color={t.muted} /></Center>;
  if (!profile.birthdate || !profile.username) return <CompleteProfileScreen profile={profile} onDone={setProfile} />;
  if (ageFrom(profile.birthdate) < 14 && consent !== 'approved') {
    return <GuardianScreen profile={profile} onRecheck={load} onName={(n) => patch({ display_name: n })} />;
  }
  if (!profile.onboarded) return <LanguageScreen profile={profile} onSave={patch} />;
  return <StoreProvider session={session} initialProfile={profile}><Main /></StoreProvider>;
}

type Tab = 'play' | 'words' | 'friends' | 'me';
type GameRun = { game: Game; challengeId?: string; hardOnly?: boolean };

export function Main() {
  const t = useTheme();
  const { error, setError, words, loading, lang } = useStore();
  const [tab, setTab] = useState<Tab>('words');
  const [run, setRun] = useState<GameRun | null>(null);
  const [langSheet, setLangSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decided, setDecided] = useState(false);
  const intro = useIntro();

  // Al entrar: si ya hay palabras listas, abre «Jugar»
  useEffect(() => {
    if (loading || decided) return;
    setDecided(true);
    if (words.some((w) => w.status === 'ok' && w.deck === lang)) setTab('play');
  }, [loading, decided, words, lang]);

  // Invitaciones pendientes (?amigo= y ?reto=)
  useEffect(() => {
    const p = takePending();
    (async () => {
      if (p.reto) {
        const { data } = await supabase.rpc('accept_challenge', { p_id: p.reto });
        setToast(data === 'ok' ? 'Reto aceptado. Lo tienes en Amigos.' : data === 'expired' ? 'Ese reto ya ha caducado.' : null);
        if (data === 'ok') setTab('friends');
      } else if (p.amigo) {
        const { data } = await supabase.rpc('add_friend', { p_code: p.amigo });
        if (data) { setToast(`Ahora ${data} y tú sois amigos`); setTab('friends'); }
      }
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  if (run) {
    const exit = () => setRun(null);
    if (run.game === 'choice') return <ChoiceGame onExit={exit} challengeId={run.challengeId} hardOnly={run.hardOnly} />;
    if (run.game === 'cards') return <CardsGame onExit={exit} />;
    return <WriteGame onExit={exit} />;
  }

  const showHeader = tab === 'play' || tab === 'words';
  return (
    <View style={{ flex: 1 }}>
      {showHeader && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><Logo size={24} /></View>
          <Pressable onPress={() => setLangSheet(true)} accessibilityRole="button" accessibilityLabel={`Idioma: ${LANGS[lang].name}. Toca para cambiar`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
              backgroundColor: pressed ? t.line : t.card, borderWidth: 1, borderColor: t.line })}>
            <Text style={{ color: t.ink, fontWeight: '800' }}>{LANGS[lang].name}</Text>
            <Text style={{ color: t.muted, fontSize: 11 }}>▼</Text>
          </Pressable>
        </View>
      )}
      {!!error && <Text onPress={() => setError(null)} style={{ color: t.bad, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 6 }}>{error}</Text>}

      <View style={{ flex: 1 }}>
        {tab === 'play' && <PlayScreen onPlay={(g, o) => setRun({ game: g, ...o })} onAddWords={() => setTab('words')} />}
        {tab === 'words' && <WordsScreen onPlay={() => setTab('play')} />}
        {tab === 'friends' && <FriendsScreen onPlayChallenge={(id) => setRun({ game: 'choice', challengeId: id })} />}
        {tab === 'me' && <MeScreen />}
      </View>

      {toast && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 90, backgroundColor: t.ink, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: t.bg, fontWeight: '700', textAlign: 'center' }}>{toast}</Text>
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: t.card, borderTopWidth: 1, borderColor: t.line }}>
        <View style={{ flexDirection: 'row', padding: 8, gap: 6 }}>
          {([['play', 'Jugar'], ['words', 'Palabras'], ['friends', 'Amigos'], ['me', 'Yo']] as const).map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: tab === k ? t.bg : 'transparent' }}>
              <Text style={{ color: tab === k ? t.ink : t.muted, fontWeight: '800', fontSize: 14 }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {langSheet && <LangSheet onClose={() => setLangSheet(false)} />}
      {intro.show && <Intro onClose={intro.close} />}
    </View>
  );
}
