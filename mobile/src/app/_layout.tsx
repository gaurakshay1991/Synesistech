import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { C } from '@/ui';

export default function RootLayout() {
  return <AuthProvider>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerShadowVisible: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: 'Secure account' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="analyse" options={{ title: 'Analyse document', presentation: 'modal' }} />
      <Stack.Screen name="matter/[id]" options={{ title: 'Matter analysis' }} />
      <Stack.Screen name="control" options={{ title: 'AI Control Tower' }} />
    </Stack>
  </AuthProvider>;
}
