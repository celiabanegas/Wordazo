import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { GOALS, SECTORS, SITUATIONS, TOPICS, type Interests } from '../lib/langs';
import { ageFrom } from '../lib/password';
import { Btn, Chip, Field, inputStyle } from '../components/ui';

/** Personalización de las sugerencias: para qué aprende, a qué se dedica y qué temas le gustan. Todo opcional. */
export default function InterestsScreen({ initial, birthdate, onSave, onSkip, editing }: {
  initial: Interests | null; birthdate: string | null; onSave: (i: Interests) => Promise<void>; onSkip: () => void; editing?: boolean;
}) {
  const t = useTheme();
  const age = birthdate ? ageFrom(birthdate) : 18;
  const adult = age >= 16; // a los menores de 16 no se les pregunta por el trabajo
  const [goals, setGoals] = useState<string[]>(initial?.goals ?? []);
  const [situation, setSituation] = useState<string | undefined>(initial?.situation);
  const [sector, setSector] = useState<string | undefined>(initial?.sector);
  const [job, setJob] = useState(initial?.job ?? '');
  const [topics, setTopics] = useState<string[]>(initial?.topics ?? []);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (l: string[]) => void, v: string, max = 9) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);
  const working = situation === 'trabajo' || situation === 'busco';
  const any = goals.length || situation || topics.length;

  const save = async () => {
    setBusy(true);
    await onSave({
      goals, situation, topics,
      ...(working && sector ? { sector } : {}),
      ...(working && job.trim() ? { job: job.trim().slice(0, 40) } : {}),
    });
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 18, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 6, marginTop: 8 }}>
        <Text style={{ color: t.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>Palabras a tu medida</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>Cuéntanos un poco de ti y te sugeriremos palabras que te sirvan de verdad. Puedes cambiarlo cuando quieras en Yo → Ajustes.</Text>
      </View>

      <Field label="¿Para qué quieres aprender?" hint="Elige las que quieras.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GOALS.filter((g) => adult || !('adult' in g)).map((g) => (
            <Chip key={g.v} label={g.l} on={goals.includes(g.v)} onPress={() => toggle(goals, setGoals, g.v)} />
          ))}
        </View>
      </Field>

      <Field label="¿A qué te dedicas?">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SITUATIONS.filter((s) => adult || !('adult' in s)).map((s) => (
            <Chip key={s.v} label={s.l} on={situation === s.v} onPress={() => setSituation(situation === s.v ? undefined : s.v)} />
          ))}
        </View>
      </Field>

      {adult && working && (
        <Field label={situation === 'busco' ? '¿De qué te gustaría trabajar?' : '¿En qué sector?'}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SECTORS.map((s) => <Chip key={s.v} label={s.l} on={sector === s.v} onPress={() => setSector(sector === s.v ? undefined : s.v)} />)}
          </View>
          <TextInput style={[inputStyle(t), { marginTop: 8 }]} value={job} onChangeText={setJob} maxLength={40}
            placeholder="Tu puesto (opcional): enfermera, camarero…" placeholderTextColor={t.muted} />
        </Field>
      )}

      <Field label="¿Qué temas te gustan?" hint="Hasta 5. Saldrán primero en las sugerencias.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TOPICS.map((x) => <Chip key={x.v} label={x.l} on={topics.includes(x.v)} onPress={() => toggle(topics, setTopics, x.v, 5)} />)}
        </View>
      </Field>

      <View style={{ flex: 1 }} />
      <Btn big kind="accent" title={busy ? 'Guardando…' : 'Guardar'} onPress={save} disabled={busy || !any} />
      <Btn title={editing ? 'Cancelar' : 'Ahora no'} kind="ghost" onPress={onSkip} disabled={busy} />
    </ScrollView>
  );
}
