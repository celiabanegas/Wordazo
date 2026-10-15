import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../lib/theme';

export const FONT = { display: { fontWeight: '800' as const, letterSpacing: -0.4 }, bold: { fontWeight: '700' as const } };

export function Btn({ title, onPress, kind = 'ink', disabled, style, big }: {
  title: string; onPress?: () => void; kind?: 'ink' | 'accent' | 'ghost' | 'good' | 'bad'; disabled?: boolean; style?: StyleProp<ViewStyle>; big?: boolean;
}) {
  const t = useTheme();
  const bg = { ink: t.ink, accent: t.accent, ghost: 'transparent', good: t.good, bad: t.bad }[kind];
  const fg = { ink: t.bg, accent: t.accentInk, ghost: t.ink, good: '#fff', bad: '#fff' }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { backgroundColor: bg, borderRadius: 14, paddingVertical: big ? 17 : 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
          borderWidth: kind === 'ghost' ? 1 : 0, borderColor: t.line, opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: big ? 18 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 16 }, style]}>{children}</View>;
}

export function Bar({ pct, color, height = 8, track }: { pct: number; color: string; height?: number; track?: string }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(pct)).current;
  useEffect(() => { Animated.timing(anim, { toValue: Math.max(0, Math.min(1, pct)), duration: 500, useNativeDriver: false }).start(); }, [pct, anim]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track || t.line, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

/** Campo con título encima */
export function Field({ label, children, hint, hintColor }: { label: string; children: React.ReactNode; hint?: string; hintColor?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      {children}
      {!!hint && <Text style={{ color: hintColor || t.muted, fontSize: 13 }}>{hint}</Text>}
    </View>
  );
}

export const inputStyle = (t: ReturnType<typeof useTheme>, state?: 'ok' | 'bad' | 'focus'): TextStyle => ({
  backgroundColor: t.card, borderWidth: state ? 2 : 1, borderColor: state === 'ok' ? t.good : state === 'bad' ? t.bad : state === 'focus' ? t.ink : t.line,
  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, color: t.ink, minWidth: 0,
});

/** Botón de altavoz para escuchar una palabra o frase */
export function Speaker({ onPress, size = 28, label = 'Escuchar' }: { onPress: () => void; size?: number; label?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? t.line : t.bg, borderWidth: 1, borderColor: t.line })}>
      <Text style={{ color: t.blue, fontSize: size * 0.5, lineHeight: size * 0.62 }}>🔊</Text>
    </Pressable>
  );
}

/** Pastilla seleccionable */
export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on }}
      style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1,
        borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : pressed ? t.line : t.card, opacity: disabled ? 0.45 : 1 })}>
      <Text style={{ color: on ? t.bg : t.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Logo de texto Wordazo */
export function Logo({ size = 24 }: { size?: number }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.ink, fontSize: size, fontWeight: '800', letterSpacing: -size * 0.03 }}>
      Word<Text style={{ backgroundColor: t.accent, color: t.accentInk }}>azo</Text>
    </Text>
  );
}
