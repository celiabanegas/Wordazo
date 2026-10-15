import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { checkPassword, cleanUsername, maskDate, parseBirthdate, usernameValid } from '../lib/password';
import { Btn, Field, inputStyle, Logo } from '../components/ui';
import InstallBanner from '../components/InstallBanner';

type Mode = 'in' | 'up' | 'forgot';
const origin = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined);

export default function AuthScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [birth, setBirth] = useState('');
  const [username, setUsername] = useState('');
  const [uState, setUState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'bad'>('idle');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const pw = checkPassword(password);
  const match = password2.length > 0 && password2 === password;
  const birthIso = parseBirthdate(birth);
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSignUp = emailOk && pw.valid && match && !!birthIso && uState === 'ok';

  // Comprueba si el nombre de usuario está libre mientras se escribe
  useEffect(() => {
    if (mode !== 'up' || !username) { setUState('idle'); return; }
    if (!usernameValid(username)) { setUState('bad'); return; }
    setUState('checking');
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: username });
      setUState(error ? 'idle' : data ? 'ok' : 'taken');
    }, 400);
    return () => clearTimeout(id);
  }, [username, mode]);

  const go = (m: Mode) => { setMode(m); setMsg(null); };

  const google = async () => {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin() } });
    if (error) setMsg({ text: 'No se pudo abrir Google. Inténtalo de nuevo.' });
  };

  const submit = async () => {
    setMsg(null);
    if (mode === 'forgot') {
      if (!emailOk) return setMsg({ text: 'Escribe el email con el que te registraste.' });
      setBusy(true);
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: origin() });
      setBusy(false);
      return setMsg({ text: 'Si ese email tiene cuenta, te hemos enviado un enlace para crear una contraseña nueva.', ok: true });
    }
    if (mode === 'in') {
      if (!emailOk || !password) return setMsg({ text: 'Escribe tu email y tu contraseña.' });
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setMsg({ text: error.message.includes('Email not confirmed') ? 'Confirma tu email con el enlace que te enviamos y vuelve a entrar.' : 'Email o contraseña incorrectos.' });
      return;
    }
    if (!canSignUp) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: origin(), data: { birthdate: birthIso, username } },
    });
    setBusy(false);
    if (error) setMsg({ text: error.message.toLowerCase().includes('registered') ? 'Ese email ya tiene cuenta. Entra con él.' : 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.' });
    // Si el email ya estaba registrado, Supabase no lo dice ni envía nada: lo detectamos aquí
    else if (data.user && (data.user.identities?.length ?? 0) === 0) setMsg({ text: 'Ese email ya tiene cuenta. Entra con «Continuar con Google» o con tu contraseña en «Entrar».' });
    else if (!data.session) setMsg({ text: 'Te hemos enviado un email. Abre el enlace para confirmar tu cuenta y vuelve a entrar. Si no llega, mira en la carpeta de spam.', ok: true });
  };

  const eye = (
    <Pressable onPress={() => setShow(!show)} accessibilityRole="button" accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} hitSlop={10}
      style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
      <Text style={{ color: t.muted, fontWeight: '700', fontSize: 13 }}>{show ? 'Ocultar' : 'Ver'}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4, marginTop: 8 }}>
          <Logo size={32} />
          {mode === 'in' && <Text style={{ color: t.muted, fontSize: 15 }}>Pilla las palabras que no conoces y apréndelas jugando.</Text>}
        </View>

        {mode !== 'forgot' ? (
          <View style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, padding: 4 }}>
            {(['in', 'up'] as const).map((m) => (
              <Pressable key={m} onPress={() => go(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center', backgroundColor: mode === m ? t.ink : 'transparent' }}>
                <Text style={{ fontWeight: '800', color: mode === m ? t.bg : t.muted }}>{m === 'in' ? 'Entrar' : 'Crear cuenta'}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Text onPress={() => go('in')} style={{ color: t.muted, fontWeight: '700' }} accessibilityRole="button">‹ Volver</Text>
            <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>Nueva contraseña</Text>
            <Text style={{ color: t.muted }}>Te enviamos un enlace a tu email para crear una contraseña nueva.</Text>
          </View>
        )}

        {mode !== 'forgot' && Platform.OS === 'web' && (
          <>
            <Pressable onPress={google} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.line : t.card,
                borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingVertical: 12 })}>
              {/* Coloca aquí el logo oficial de Google (public/google-g.svg), descargado de su guía de marca */}
              <Image source={{ uri: '/google-g.svg' }} style={{ width: 18, height: 18 }} accessibilityIgnoresInvertColors />
              <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>Continuar con Google</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
              <Text style={{ color: t.muted, fontSize: 13 }}>o con tu email</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
            </View>
          </>
        )}

        <Field label="Email">
          <TextInput style={inputStyle(t)} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
            textContentType="emailAddress" placeholder="tu@email.com" placeholderTextColor={t.muted} />
        </Field>

        {mode === 'up' && (
          <Field label="Nombre de usuario"
            hint={uState === 'ok' ? `@${username} está libre` : uState === 'taken' ? `@${username} ya está cogido. Prueba otro.` : uState === 'bad' ? 'De 3 a 20 caracteres: letras, números, punto o guion bajo' : uState === 'checking' ? 'Comprobando…' : 'Tus amigos te buscarán con este nombre'}
            hintColor={uState === 'ok' ? t.good : uState === 'taken' || uState === 'bad' ? t.bad : t.muted}>
            <View>
              <Text style={{ position: 'absolute', left: 14, top: 13, fontSize: 17, color: t.muted, zIndex: 1 }}>@</Text>
              <TextInput style={[inputStyle(t, uState === 'ok' ? 'ok' : uState === 'taken' ? 'bad' : undefined), { paddingLeft: 32 }]} value={username}
                onChangeText={(v) => setUsername(cleanUsername(v))} autoCapitalize="none" autoCorrect={false} placeholder="tu_nombre" placeholderTextColor={t.muted} maxLength={20} />
            </View>
          </Field>
        )}

        {mode !== 'forgot' && (
          <Field label="Contraseña">
            <View>
              <TextInput style={[inputStyle(t), { paddingRight: 70 }]} value={password} onChangeText={setPassword} secureTextEntry={!show}
                textContentType={mode === 'up' ? 'newPassword' : 'password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                onSubmitEditing={mode === 'in' ? submit : undefined} />
              {eye}
            </View>
            {mode === 'up' && password.length > 0 && (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= pw.score ? (pw.score >= 3 ? t.good : pw.score === 2 ? t.accent : t.bad) : t.line }} />
                  ))}
                  <Text style={{ color: pw.score >= 3 ? t.good : pw.score === 2 ? t.ink : t.bad, fontWeight: '800', fontSize: 12, marginLeft: 6 }}>{pw.label}</Text>
                </View>
                {!!pw.next && <Text style={{ color: pw.valid ? t.muted : t.bad, fontSize: 13 }}>{pw.next}</Text>}
              </View>
            )}
          </Field>
        )}

        {mode === 'in' && (
          <Text onPress={() => go('forgot')} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', alignSelf: 'flex-end' }}>¿Has olvidado la contraseña?</Text>
        )}

        {mode === 'up' && (
          <>
            <Field label="Repite la contraseña" hint={password2 && !match ? 'Las contraseñas no coinciden' : undefined} hintColor={t.bad}>
              <View>
                <TextInput style={[inputStyle(t, password2 ? (match ? 'ok' : 'bad') : undefined), { paddingRight: 40 }]} value={password2} onChangeText={setPassword2}
                  secureTextEntry={!show} textContentType="newPassword" autoComplete="new-password" />
                {match && <Text style={{ position: 'absolute', right: 14, top: 14, color: t.good, fontWeight: '800' }}>✓</Text>}
              </View>
            </Field>
            <Field label="Fecha de nacimiento" hint={birth.length >= 14 && !birthIso ? 'Revisa la fecha (día / mes / año)' : undefined} hintColor={t.bad}>
              <TextInput style={inputStyle(t)} value={birth} onChangeText={(v) => setBirth(maskDate(v))} placeholder="dd / mm / aaaa" placeholderTextColor={t.muted}
                keyboardType="number-pad" maxLength={14} />
            </Field>
          </>
        )}

        {msg && <Text style={{ color: msg.ok ? t.good : t.bad, fontWeight: '600' }}>{msg.text}</Text>}

        <View style={{ flex: 1, minHeight: 8 }} />
        <Btn big kind="accent" onPress={submit} disabled={busy || (mode === 'up' && !canSignUp)}
          title={busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'} />
        {mode === 'up' && (
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
            Al continuar aceptas la <Text style={{ textDecorationLine: 'underline' }} onPress={() => Platform.OS === 'web' && window.open('/privacidad.html', '_blank')}>política de privacidad</Text>
          </Text>
        )}
        {mode === 'in' && <InstallBanner />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Pantalla para poner una contraseña nueva tras abrir el enlace del email */
export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const pw = checkPassword(p1);
  const ok = pw.valid && p1 === p2;
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) setMsg('No se pudo cambiar. El enlace puede haber caducado: pide otro.');
    else onDone();
  };
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Logo size={28} />
      <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>Crea una contraseña nueva</Text>
      <Field label="Contraseña nueva" hint={p1 ? `${pw.label}${pw.next ? ` · ${pw.next}` : ''}` : undefined} hintColor={pw.valid ? t.good : t.bad}>
        <TextInput style={inputStyle(t)} value={p1} onChangeText={setP1} secureTextEntry textContentType="newPassword" />
      </Field>
      <Field label="Repite la contraseña" hint={p2 && p1 !== p2 ? 'Las contraseñas no coinciden' : undefined} hintColor={t.bad}>
        <TextInput style={inputStyle(t, p2 ? (p1 === p2 ? 'ok' : 'bad') : undefined)} value={p2} onChangeText={setP2} secureTextEntry textContentType="newPassword" />
      </Field>
      {!!msg && <Text style={{ color: t.bad }}>{msg}</Text>}
      <View style={{ flex: 1 }} />
      <Btn big kind="accent" title={busy ? 'Guardando…' : 'Guardar contraseña'} onPress={save} disabled={!ok || busy} />
    </ScrollView>
  );
}
