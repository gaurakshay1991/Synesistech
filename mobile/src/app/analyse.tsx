import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { SynesisAPI, UploadAsset } from '@/lib/api';
import { Action, C, Card, Eyebrow, Muted, Pill, Screen, styles } from '@/ui';

export default function Analyse() {
  const [asset, setAsset] = useState<UploadAsset | null>(null);
  const [title, setTitle] = useState('');
  const [matter, setMatter] = useState('');
  const [jurisdiction, setJurisdiction] = useState('India');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (!result.canceled) {
      const a = result.assets[0];
      setAsset({ uri: a.uri, name: a.name, mimeType: a.mimeType });
      if (!title) setTitle(a.name.replace(/\.[^.]+$/, ''));
      await Haptics.selectionAsync();
    }
  }

  async function submit() {
    if (!asset && text.trim().length < 20) return setError('Choose a supported document or paste at least 20 readable characters.');
    setBusy(true); setError('');
    try {
      const data = await SynesisAPI.analyzeDocument({ asset, text, title, matter, jurisdiction, analysisMode: 'Deep', riskAppetite: 'Conservative' });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/matter/[id]', params: { id: data.document.id } });
    } catch (e: any) {
      setError(e.message || 'Analysis could not be completed.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setBusy(false); }
  }

  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 7 }}><Eyebrow>INDEPENDENT INTAKE</Eyebrow><Text style={styles.sectionTitle}>Give the brain one source at a time</Text><Muted>The selected document is analysed independently. Other document text is excluded unless you later choose institutional scope.</Muted></View>
    <Card style={{ gap: 12 }}>
      <View style={styles.between}><Text style={{ color: C.text, fontWeight: '800' }}>Source evidence</Text><Pill value={asset ? 'Ready' : 'Required'} /></View>
      {asset ? <View style={{ padding: 12, backgroundColor: C.panel2, borderRadius: 14 }}><Text style={{ color: C.text, fontWeight: '800' }}>{asset.name}</Text><Muted>{asset.mimeType || 'Document'}</Muted></View> : <Muted>PDF, DOCX, TXT, CSV, JSON, Markdown, XML, HTML or RTF from iCloud Drive, Files or another permitted document provider.</Muted>}
      <Action title="Choose document from Files" secondary onPress={pickDocument} />
      <Muted>For a paper document, use iPhone's system document scanner to create a PDF, then choose that PDF here. Raw photo/OCR intake is intentionally not exposed until the server-side vision path is separately validated.</Muted>
    </Card>
    <Card style={{ gap: 12 }}>
      <View><Text style={styles.label}>Title (optional)</Text><TextInput value={title} onChangeText={setTitle} style={styles.field} placeholder="Inferred from file if blank" placeholderTextColor={C.muted} /></View>
      <View><Text style={styles.label}>Matter (optional)</Text><TextInput value={matter} onChangeText={setMatter} style={styles.field} placeholder="Vendor agreement, policy, dispute…" placeholderTextColor={C.muted} /></View>
      <View><Text style={styles.label}>Jurisdiction</Text><TextInput value={jurisdiction} onChangeText={setJurisdiction} style={styles.field} /></View>
      <View><Text style={styles.label}>Or paste approved source text</Text><TextInput multiline value={text} onChangeText={setText} style={styles.textarea} placeholder="Paste text only where your organisation permits mobile processing." placeholderTextColor={C.muted} /></View>
      {error ? <Text style={{ color: C.red, lineHeight: 19 }}>{error}</Text> : null}
      <Action title={busy ? 'Analysing evidence, law and exposure…' : 'Run deep independent analysis'} onPress={submit} disabled={busy} />
      <Muted>Current-law research and external AI use remain subject to the server-side information-flow policy. Unsupported monetary exposure is never invented.</Muted>
    </Card>
  </ScrollView></KeyboardAvoidingView></Screen>;
}
