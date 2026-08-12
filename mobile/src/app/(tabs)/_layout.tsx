import { Tabs } from 'expo-router';
import { C } from '@/ui';

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: C.bg },
    headerTintColor: C.text,
    headerShadowVisible: false,
    tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line, height: 84, paddingTop: 8, paddingBottom: 22 },
    tabBarActiveTintColor: C.teal,
    tabBarInactiveTintColor: C.muted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '800' }
  }}>
    <Tabs.Screen name="index" options={{ title: 'Neuro', tabBarLabel: 'Neuro' }} />
    <Tabs.Screen name="matters" options={{ title: 'Matters' }} />
    <Tabs.Screen name="brain" options={{ title: 'Live Brain' }} />
    <Tabs.Screen name="tasks" options={{ title: 'Work' }} />
  </Tabs>;
}
