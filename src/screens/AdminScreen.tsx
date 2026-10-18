import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { GOALS, LANGS, LEVELS, SECTORS, SITUATIONS, type Lang } from '../lib/langs';

// Panel de Wordazo: solo números totales (nunca emails ni datos de una persona).
// Los datos los da la función admin_stats del servidor, que solo responde a las cuentas de app_admins.

type Day = { d: string; signups: number; active: number; words: number; ai: number };
type Stats = {
  totals: Record<string, number>;
  days: Day[];
  langs: Record<string, number>; levels: Record<string, number>; ages: Record<string, number>;
  goals: Record<string, number>; situations: Record<string, number>; sectors: Record<string, number>;
};

const label = (list: readonly { v: string | number; l: string }[], v: string) => list.find((x) => String(x.v) === v)?.l ?? v;
const AGE_ORDER = ['<14', '14-17', '18-24', '25-34', '35-49', '50+', 'sin dato'];
const fmtDay = (iso: string) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };

export default function AdminScreen({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setErr(false);
    const { data, error } = await supabase.rpc('admin_stats');
    setBusy(false);
    if (error || !data) setErr(true); else setS(data as Stats);
  }, []);
  useEffect(() => { load(); }, [load]);

  const T = s?.totals ?? {};
  const pct = T.answered ? Math.round((T.correct / T.answered) * 100) : 0;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, zIndex: 45 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: t.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Panel de Wordazo</Text>
          <Text onPress={load} accessibilityRole="button" style={{ color: t.blue, fontWeight: '700', padding: 6 }}>{busy ? 'Cargando…' : 'Actualizar'}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar el panel" hitSlop={10}>
            <Text style={{ color: t.muted, fontSize: 22, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
        <Text style={{ color: t.muted, marginTop: -10 }}>Solo lo ves tú. Datos totales, sin información de ninguna persona.</Text>

        {err && <Text style={{ color: t.bad }}>No se pudieron cargar los datos. <Text onPress={load} style={{ color: t.blue, fontWeight: '700' }}>Reintentar</Text></Text>}
        {!s && !err && <ActivityIndicator color={t.muted} style={{ marginTop: 40 }} />}

        {s && (
          <>
            <Section title="Usuarios">
              <Tiles items={[
                ['Registrados', T.users], ['Han empezado', T.onboarded], ['Activos hoy', T.active_today],
                ['Activos 7 días', T.active_7], ['Activos 30 días', T.active_30], ['Menores de 14', T.minors],
              ]} />
              <BarChart title="Altas por día · últimos 30 días" days={s.days} k="signups" unit="altas" />
              <BarChart title="Usuarios que juegan cada día" days={s.days} k="active" unit="usuarios" />
            </Section>

            <Section title="Uso">
              <Tiles items={[
                ['Palabras guardadas', T.words], ['Nuevas en 7 días', T.words_7], ['Respuestas', T.answered],
                ['Aciertos', `${pct} %`], ['Amistades', T.friendships], ['Retos', T.challenges],
              ]} />
              <BarChart title="Palabras nuevas por día" days={s.days} k="words" unit="palabras" />
            </Section>

            <Section title="Inteligencia artificial">
              <Text style={{ color: t.muted, fontSize: 13 }}>
                Cada palabra nueva para el diccionario es una llamada a la IA; las repetidas no gastan. El plan gratis de Groq da para unas 1.000 al día.
              </Text>
              <Tiles items={[
                ['Palabras en el diccionario', T.ai_dictionary], ['Llamadas hoy', T.ai_dictionary_today],
                ['Paquetes por tema', T.ai_packs], ['«Para ti» esta semana', T.ai_suggestions_week],
              ]} />
              <BarChart title="Palabras traducidas por la IA cada día" days={s.days} k="ai" unit="llamadas" />
            </Section>

            <Section title="Quiénes son">
              <Breakdown title="Idiomas que aprenden (de cada 100 usuarios)" of={T.users} data={s.langs} name={(k) => LANGS[k as Lang]?.name ?? k} />
              <Breakdown title="Nivel" data={s.levels} name={(k) => label(LEVELS, k)} />
              <Breakdown title="Edad" data={s.ages} name={(k) => (k === 'sin dato' ? 'Sin dato' : `${k} años`)} order={AGE_ORDER} />
              <Breakdown title="Para qué aprenden (pueden marcar varias)" of={null} data={s.goals} name={(k) => label(GOALS, k)} empty="Nadie ha personalizado aún." />
              <Breakdown title="A qué se dedican" data={s.situations} name={(k) => label(SITUATIONS, k)} empty="Nadie ha personalizado aún." />
              <Breakdown title="Sector" data={s.sectors} name={(k) => label(SECTORS, k)} empty="Nadie ha indicado sector." />
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: t.ink, fontSize: 18, fontWeight: '800', marginTop: 6 }}>{title}</Text>
      {children}
    </View>
  );
}

/** Cifras sueltas: número grande y etiqueta debajo */
function Tiles({ items }: { items: [string, number | string | undefined][] }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([l, v]) => (
        <View key={l} style={{ flexBasis: '31%', flexGrow: 1, minWidth: 100, backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12, gap: 2 }}>
          <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{v ?? 0}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/** Columnas por día (una sola serie). Toca una columna para ver su valor. */
function BarChart({ title, days, k, unit }: { title: string; days: Day[]; k: keyof Omit<Day, 'd'>; unit: string }) {
  const t = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  const vals = days.map((d) => d[k]);
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const H = 120;
  const shown = sel != null ? days[sel] : null;
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ flex: 1, color: t.ink, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 13, fontVariant: ['tabular-nums'] }}>
          {shown ? `${fmtDay(shown.d)}: ${shown[k]} ${unit}` : `Total: ${total}`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 2, borderBottomWidth: 1, borderColor: t.line }}
        accessibilityLabel={`${title}. Total ${total} ${unit}.`}>
        {days.map((d, i) => {
          const v = d[k];
          return (
            <Pressable key={d.d} onPress={() => setSel(sel === i ? null : i)} accessibilityRole="button" accessibilityLabel={`${fmtDay(d.d)}: ${v} ${unit}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <View style={{ height: v ? Math.max(3, (v / max) * (H - 4)) : 0, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                backgroundColor: sel === i ? t.ink : t.blue, opacity: sel == null || sel === i ? 1 : 0.45 }} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.muted, fontSize: 12 }}>{fmtDay(days[0].d)}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>Máx. {max}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>Hoy</Text>
      </View>
    </View>
  );
}

/** Reparto en barras horizontales, de mayor a menor, con el número al lado */
function Breakdown({ title, data, name, order, empty, of }: { title: string; data: Record<string, number>; name: (k: string) => string; order?: string[]; empty?: string; of?: number | null }) {
  const t = useTheme();
  let rows = Object.entries(data || {});
  rows = order ? rows.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])) : rows.sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  // % sobre el total de respuestas; en las de varias opciones, sobre los usuarios (of) o sin %
  const sum = of === undefined ? rows.reduce((a, r) => a + r[1], 0) : of;
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 14, gap: 8 }}>
      <Text style={{ color: t.ink, fontWeight: '700' }}>{title}</Text>
      {!rows.length && <Text style={{ color: t.muted }}>{empty ?? 'Sin datos todavía.'}</Text>}
      {rows.map(([k, v]) => (
        <View key={k} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>{name(k)}</Text>
            <Text style={{ color: t.muted, fontSize: 14, fontVariant: ['tabular-nums'] }}>{v}{sum ? ` · ${Math.round((v / sum) * 100)} %` : ''}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.line, overflow: 'hidden' }}>
            <View style={{ width: `${(v / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.blue }} />
          </View>
        </View>
      ))}
    </View>
  );
}
