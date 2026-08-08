import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const C = {
  bg: '#071019',
  panel: '#0E1A26',
  panel2: '#132231',
  line: '#203548',
  text: '#F4F7FA',
  muted: '#8CA1B5',
  teal: '#38D7C7',
  blue: '#68A9FF',
  green: '#5ED89A',
  amber: '#F5BA62',
  red: '#FF7A7A'
};

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Pill({ value }: { value?: string | number | null }) {
  const text = String(value ?? 'Unrated');
  const lower = text.toLowerCase();
  const tone = lower.includes('critical') || lower.includes('high') ? C.red : lower.includes('medium') || lower.includes('attention') ? C.amber : lower.includes('low') || lower.includes('ready') || lower.includes('active') ? C.green : C.blue;
  return <View style={[styles.pill, { borderColor: tone }]}><Text style={[styles.pillText, { color: tone }]}>{text}</Text></View>;
}

export function Action({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.actionSecondary, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}><Text style={[styles.actionText, secondary && { color: C.text }]}>{title}</Text></Pressable>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 20, padding: 16 },
  eyebrow: { color: C.teal, fontSize: 11, letterSpacing: 1.1, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: C.text, fontSize: 28, lineHeight: 33, fontWeight: '800' },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#0B1520' },
  pillText: { fontSize: 11, fontWeight: '800' },
  action: { minHeight: 48, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  actionSecondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
  actionText: { color: '#04120F', fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  field: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, color: C.text, borderRadius: 14, minHeight: 48, paddingHorizontal: 13, fontSize: 15 },
  textarea: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, color: C.text, borderRadius: 14, minHeight: 120, padding: 13, fontSize: 15, textAlignVertical: 'top' },
  label: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  value: { color: C.text, fontSize: 22, fontWeight: '800' },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 12 }
});
