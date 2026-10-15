import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { LANGS, LANG_ORDER, LEVELS, type Lang, type Level } from '../lib/langs';
import { maskDate, parseBirthdate } from '../lib/password';
import { siteOrigin } from '../lib/links';
import { SITE_URL } from '../lib/config';
import type { Profile } from '../lib/types';
import { Btn, Field, inputStyle, Logo } from '../components/ui';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
    {children}
  </ScrollView>
);
const signOut = () => supabase.auth.signOut();

/** Para quien entra con Google: falta la fecha de nacimiento */
export function BirthdateScreen({ onSave }: { onSave: (iso: string) => Promise<void> }) {
  const t = useTheme();
  const [v, setV] = useState('');
  const iso = parseBirthdate(v);
  return (
    <Shell>
      <Logo size={28} />
      <View style={{ gap: 6, marginTop: 20 }}>
        <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>¿Cuándo naciste?</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>Lo necesitamos para cumplir la ley de protección de datos. No se muestra a nadie.</Text>
      </View>
      <Field label="Fecha de nacimiento" hint={v.length >= 14 && !iso ? 'Revisa la fecha (día / mes / año)' : undefined} hintColor={t.bad}>
        <TextInput style={inputStyle(t)} value={v} onChangeText={(x) => setV(maskDate(x))} placeholder="dd / mm / aaaa" placeholderTextColor={t.muted} keyboardType="number-pad" maxLength={14} />
      </Field>
      <View style={{ flex: 1 }} />
      <Btn big kind="accent" title="Continuar" disabled={!iso} onPress={() => iso && onSave(iso)} />
      <Text onPress={signOut} style={{ color: t.muted, textAlign: 'center', fontWeight: '700' }}>Cerrar sesión</Text>
    </Shell>
  );
}

/** Menores de 14: pedir el permiso de un adulto */
export function GuardianScreen({ profile, onRecheck, onName }: { profile: Profile; onRecheck: () => Promise<void>; onName: (n: string) => Promise<void> }) {
  const t = useTheme();
  const [name, setName] = useState(profile.display_name);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<{ email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  useEffect(() => {
    supabase.from('guardian_consents').select('guardian_email, status').maybeSingle().then(({ data }) => {
      if (data && data.status === 'pending') setPending({ email: data.guardian_email });
    });
  }, []);

  const send = async (to: string) => {
    setMsg(null);
    if (!name.trim()) return setMsg({ text: 'Escribe tu nombre para que tu familia sepa quién eres.' });
    if (!/^\S+@\S+\.\S+$/.test(to.trim())) return setMsg({ text: 'Escribe un email válido.' });
    setBusy(true);
    if (name.trim() !== profile.display_name) await onName(name.trim());
    const { data, error } = await supabase.functions.invoke('guardian', { body: { action: 'request', guardian_email: to.trim(), site: siteOrigin(SITE_URL) } });
    setBusy(false);
    if (error) return setMsg({ text: 'No se pudo enviar. Si acabas de enviarlo, espera un minuto.' });
    if (data?.status === 'approved') return onRecheck();
    setPending({ email: to.trim() });
    if (data?.sent === false) setMsg({ text: 'El envío de emails aún no está activado en Wordazo. Avisa a quien gestiona la app.' });
    else setMsg({ text: 'Email enviado. Cuando tu madre, padre o tutor dé su permiso, pulsa «Ya me lo han dado».', ok: true });
  };

  return (
    <Shell>
      <Logo size={28} />
      <View style={{ gap: 8, marginTop: 20 }}>
        <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>{pending ? 'Esperando el permiso' : 'Un último paso'}</Text>
        <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}>
          {pending
            ? `Hemos enviado un email a ${pending.email}. En cuanto acepte, tu cuenta se activa.`
            : 'Como tienes menos de 14 años, un adulto tiene que darte permiso. Le mandamos un email y, en cuanto acepte, tu cuenta se activa.'}
        </Text>
      </View>
      {!pending && (
        <>
          <Field label="Tu nombre">
            <TextInput style={inputStyle(t)} value={name} onChangeText={setName} placeholder="Lucía" placeholderTextColor={t.muted} maxLength={30} autoComplete="given-name" />
          </Field>
          <Field label="Email de tu madre, padre o tutor">
            <TextInput style={inputStyle(t)} value={email} onChangeText={setEmail} placeholder="nombre@email.com" placeholderTextColor={t.muted}
              autoCapitalize="none" keyboardType="email-address" />
          </Field>
        </>
      )}
      {msg && <Text style={{ color: msg.ok ? t.good : t.bad, fontWeight: '600' }}>{msg.text}</Text>}
      <View style={{ flex: 1 }} />
      {pending ? (
        <>
          <Btn big kind="accent" title="Ya me lo han dado" onPress={onRecheck} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn kind="ghost" title="Reenviar email" style={{ flex: 1 }} onPress={() => send(pending.email)} disabled={busy} />
            <Btn kind="ghost" title="Cambiar email" style={{ flex: 1 }} onPress={() => { setPending(null); setMsg(null); }} />
          </View>
        </>
      ) : (
        <Btn big kind="accent" title={busy ? 'Enviando…' : 'Enviar permiso'} onPress={() => send(email)} disabled={busy} />
      )}
      <Text onPress={signOut} style={{ color: t.muted, textAlign: 'center', fontWeight: '700' }}>Cerrar sesión</Text>
    </Shell>
  );
}

/** Elegir idiomas, nivel y nombre */
export function LanguageScreen({ profile, onSave }: { profile: Profile; onSave: (p: Partial<Profile>) => Promise<void> }) {
  const t = useTheme();
  const [name, setName] = useState(profile.display_name);
  const [langs, setLangs] = useState<Lang[]>(profile.langs?.length ? profile.langs : ['en']);
  const [level, setLevel] = useState<Level>(profile.level || 'mid');
  const [busy, setBusy] = useState(false);
  const toggle = (l: Lang) => setLangs((ls) => (ls.includes(l) ? (ls.length > 1 ? ls.filter((x) => x !== l) : ls) : [...ls, l]));
  const save = async () => {
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
    await onSave({ display_name: name.trim(), langs, current_lang: langs[0], level, onboarded: true, tz });
    setBusy(false);
  };
  return (
    <Shell>
      <Text style={{ color: t.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 8 }}>¿Qué quieres aprender?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LANG_ORDER.map((l) => {
          const on = langs.includes(l);
          return (
            <Pressable key={l} onPress={() => toggle(l)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={{ width: '48%', flexGrow: 1, padding: 12, borderRadius: 16, gap: 6, borderWidth: on ? 2 : 1,
                borderColor: on ? t.ink : t.line, backgroundColor: on ? t.accent : t.card }}>
              <Text style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
                overflow: 'hidden', backgroundColor: on ? t.accentInk : t.bg, color: on ? t.accent : t.muted }}>{LANGS[l].code}</Text>
              <Text style={{ color: on ? t.accentInk : t.ink, fontWeight: '800', fontSize: 16 }}>{LANGS[l].name}</Text>
              {!!LANGS[l].sub && <Text style={{ color: on ? t.accentInk : t.muted, fontSize: 12 }}>{LANGS[l].sub}</Text>}
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.muted, fontSize: 13 }}>Puedes elegir varios y cambiar cuando quieras desde el botón del idioma, arriba.</Text>
      <Field label="¿Qué nivel tienes?">
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {LEVELS.map((x) => (
            <Pressable key={x.v} onPress={() => setLevel(x.v)} accessibilityRole="radio" accessibilityState={{ selected: level === x.v }}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: level === x.v ? t.ink : t.line, backgroundColor: level === x.v ? t.ink : t.card }}>
              <Text style={{ color: level === x.v ? t.bg : t.ink, fontWeight: '800', fontSize: 13 }}>{x.l}</Text>
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="¿Cómo te llamas?" hint="Tus amigos verán solo tu nombre y la inicial del apellido.">
        <TextInput style={inputStyle(t)} value={name} onChangeText={setName} placeholder="Tu nombre" placeholderTextColor={t.muted} maxLength={30} autoComplete="name" />
      </Field>
      <View style={{ flex: 1 }} />
      <Btn big kind="accent" title={busy ? 'Un momento…' : 'Empezar'} onPress={save} disabled={busy || !name.trim()} />
    </Shell>
  );
}

/** Página que abre la madre, padre o tutor desde el email (no necesita cuenta) */
export function GuardianApproveScreen({ token, onClose }: { token: string; onClose: () => void }) {
  const t = useTheme();
  const [state, setState] = useState<'loading' | 'ask' | 'done' | 'invalid'>('loading');
  const [name, setName] = useState('');
  useEffect(() => {
    supabase.functions.invoke('guardian', { body: { action: 'info', token } }).then(({ data, error }) => {
      if (error || !data || data.error) return setState('invalid');
      setName(data.name || 'Tu hijo o hija');
      setState(data.status === 'approved' ? 'done' : 'ask');
    });
  }, [token]);
  const approve = async () => {
    setState('loading');
    const { data, error } = await supabase.functions.invoke('guardian', { body: { action: 'approve', token } });
    setState(error || data?.error ? 'invalid' : 'done');
  };
  const finish = () => {
    if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname);
    onClose();
  };
  return (
    <Shell>
      <Logo size={28} />
      {state === 'loading' && <ActivityIndicator color={t.muted} style={{ marginTop: 40 }} />}
      {state === 'invalid' && (
        <View style={{ gap: 8, marginTop: 20 }}>
          <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>Este enlace no es válido</Text>
          <Text style={{ color: t.muted }}>Puede que ya no exista. Pide que te envíen un email nuevo desde la app.</Text>
        </View>
      )}
      {state === 'ask' && (
        <View style={{ gap: 12, marginTop: 20 }}>
          <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>{name} quiere usar Wordazo</Text>
          <Text style={{ color: t.ink, fontSize: 16, lineHeight: 24 }}>Wordazo es una app para aprender vocabulario de idiomas jugando unos minutos al día.</Text>
          <View style={{ backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 14, gap: 6 }}>
            <Text style={{ color: t.ink, fontWeight: '800' }}>Qué guardamos</Text>
            <Text style={{ color: t.muted, lineHeight: 21 }}>Su email, su fecha de nacimiento, su nombre de pila y su progreso. Nada más.</Text>
            <Text style={{ color: t.ink, fontWeight: '800', marginTop: 6 }}>Qué no hay</Text>
            <Text style={{ color: t.muted, lineHeight: 21 }}>Ni chat, ni mensajes entre usuarios, ni publicidad, ni ubicación. Sus amigos solo ven su nombre de pila y la inicial del apellido.</Text>
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Puedes leer la <Text style={{ textDecorationLine: 'underline' }} onPress={() => Platform.OS === 'web' && window.open('/privacidad.html', '_blank')}>política de privacidad</Text>.
            La cuenta y todos sus datos se pueden borrar en cualquier momento desde la app.
          </Text>
          <Btn big kind="accent" title="Doy mi permiso" onPress={approve} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>Si no das permiso, cierra esta página y la cuenta no se activará.</Text>
        </View>
      )}
      {state === 'done' && (
        <View style={{ gap: 8, marginTop: 20 }}>
          <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>Permiso concedido</Text>
          <Text style={{ color: t.muted, fontSize: 16 }}>Gracias. {name} ya puede usar Wordazo.</Text>
          <Btn kind="ghost" title="Ir a Wordazo" onPress={finish} style={{ marginTop: 12 }} />
        </View>
      )}
    </Shell>
  );
}
