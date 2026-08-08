import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth';
import { Action, C, Card, Eyebrow, Muted, Screen, Title, styles } from '@/ui';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try {
      const user = await signIn(email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(user.mustChangePassword ? '/change-password' : '/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Sign in failed.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setBusy(false); }
  }

  return <Screen>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 9 }}><Eyebrow>SYNESIS NEURO INTELLIGENCE</Eyebrow><Title>Your institutional brain, in your hand.</Title><Muted>Evidence-scoped document intelligence, current-law research, exposure reasoning and governed decisions.</Muted></View>
        <Card style={{ gap: 14 }}>
          <View><Text style={styles.label}>Email</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.field} placeholder="you@organisation.com" placeholderTextColor={C.muted} /></View>
          <View><Text style={styles.label}>Password</Text><TextInput secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} style={styles.field} placeholder="••••••••••••" placeholderTextColor={C.muted} /></View>
          {error ? <Text style={{ color: C.red, lineHeight: 19 }}>{error}</Text> : null}
          <Action title={busy ? 'Signing in…' : 'Enter SYNESIS'} onPress={submit} disabled={busy || !email || !password} />
          <Muted>Sessions are stored in iOS secure storage. Restricted information remains subject to your organisation's information-flow policy.</Muted>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}
