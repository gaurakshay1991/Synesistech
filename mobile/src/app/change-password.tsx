import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Action, C, Card, Muted, Screen, styles } from '@/ui';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (newPassword !== confirm) return setError('New passwords do not match.');
    setBusy(true); setError('');
    try { await changePassword(currentPassword, newPassword); router.replace('/(tabs)'); }
    catch (e: any) { setError(e.message || 'Password change failed.'); }
    finally { setBusy(false); }
  }

  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView contentContainerStyle={[styles.content, { justifyContent: 'center', flexGrow: 1 }]}>
    <Card style={{ gap: 14 }}><Text style={styles.sectionTitle}>Replace the temporary password</Text><Muted>Use at least 12 characters with upper/lowercase, a number and a symbol.</Muted>
      <View><Text style={styles.label}>Current password</Text><TextInput secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} style={styles.field} /></View>
      <View><Text style={styles.label}>New password</Text><TextInput secureTextEntry value={newPassword} onChangeText={setNewPassword} style={styles.field} /></View>
      <View><Text style={styles.label}>Confirm new password</Text><TextInput secureTextEntry value={confirm} onChangeText={setConfirm} style={styles.field} /></View>
      {error ? <Text style={{ color: C.red }}>{error}</Text> : null}<Action title={busy ? 'Securing…' : 'Secure account'} onPress={submit} disabled={busy || !currentPassword || !newPassword || !confirm} />
    </Card>
  </ScrollView></KeyboardAvoidingView></Screen>;
}
