import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

/** Panel que sube desde abajo */
export default function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
      <Pressable onPress={onClose} accessibilityLabel="Cerrar" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: t.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%' }}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.line }} />
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
