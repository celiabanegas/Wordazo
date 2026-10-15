import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { LANGS, LANG_ORDER, LEVELS, type Lang } from '../lib/langs';
import { Btn, Label } from './ui';
import Sheet from './Sheet';

/** Cambiar de idioma, añadir otro y ajustar el nivel */
export default function LangSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { profile, updateProfile, words } = useStore();
  const mine = profile.langs?.length ? profile.langs : [profile.current_lang];
  const others = LANG_ORDER.filter((l) => !mine.includes(l));
  const count = (l: Lang) => words.filter((w) => w.deck === l).length;

  const pick = (l: Lang) => { updateProfile({ current_lang: l, langs: mine.includes(l) ? mine : [...mine, l] }); onClose(); };

  return (
    <Sheet onClose={onClose}>
      <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }}>Tus idiomas</Text>
      <View style={{ gap: 8 }}>
        {mine.map((l) => {
          const on = l === profile.current_lang;
          return (
            <Pressable key={l} onPress={() => pick(l)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.accent : t.bg }}>
              <Text style={{ fontSize: 11, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', backgroundColor: on ? t.accentInk : t.card, color: on ? t.accent : t.muted }}>{LANGS[l].code}</Text>
              <Text style={{ flex: 1, color: on ? t.accentInk : t.ink, fontWeight: '800', fontSize: 16 }}>{LANGS[l].name}</Text>
              <Text style={{ color: on ? t.accentInk : t.muted }}>{count(l)} palabras</Text>
            </Pressable>
          );
        })}
      </View>
      {others.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label>Añadir otro idioma</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {others.map((l) => (
              <Pressable key={l} onPress={() => pick(l)} accessibilityRole="button"
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
                <Text style={{ color: t.ink, fontWeight: '700' }}>+ {LANGS[l].name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Label>Tu nivel</Label>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {LEVELS.map((x) => (
            <Pressable key={x.v} onPress={() => updateProfile({ level: x.v })} accessibilityRole="radio" accessibilityState={{ selected: profile.level === x.v }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: profile.level === x.v ? t.ink : t.line, backgroundColor: profile.level === x.v ? t.ink : t.bg }}>
              <Text style={{ color: profile.level === x.v ? t.bg : t.ink, fontWeight: '800', fontSize: 13 }}>{x.l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Btn title="Listo" kind="ghost" onPress={onClose} />
    </Sheet>
  );
}
