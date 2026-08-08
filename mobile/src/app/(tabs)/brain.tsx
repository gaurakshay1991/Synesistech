import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SynesisAPI } from '@/lib/api';
import { Action, C, Card, Eyebrow, Muted, Pill, Screen, styles } from '@/ui';

const modes = ['governed', 'probabilistic', 'deterministic'] as const;

export default function Brain() {
  const [docs, setDocs] = useState<any[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [scope, setScope] = useState<'document' | 'institution'>('institution');
  const [mode, setMode] = useState<(typeof modes)[number]>('governed');
  const [question, setQuestion] = useState('What requires attention now, what changed in current law, what is the exposure, and what should happen next?');
  const [answer, setAnswer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { SynesisAPI.documents().then(data => setDocs(data.documents || [])).catch(() => {}); }, []);

  async function run() {
    if (scope === 'document' && !documentId) return setError('Select one document for isolated analysis.');
    setBusy(true); setError(''); setAnswer(null);
    try {
      const selected = docs.find(d => d.id === documentId);
      const data = await SynesisAPI.cognitiveRun({
        question,
        mode,
        dataClass: 'internal',
        jurisdiction: selected?.jurisdiction || 'India',
        scope: scope === 'document' ? `document:${documentId}` : 'institution',
        documentId: scope === 'document' ? documentId : undefined
      });
      setAnswer(data);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || 'Brain run failed.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setBusy(false); }
  }

  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 7 }}><Eyebrow>LIVE BRAIN</Eyebrow><Text style={styles.sectionTitle}>Ask the central intelligence</Text><Muted>Natural-language reasoning with deterministic governance, probabilistic challenge and current-law research where policy permits.</Muted></View>
    <Card style={{ gap: 12 }}>
      <Text style={styles.label}>Scope</Text>
      <View style={styles.row}>{(['institution', 'document'] as const).map(item => <Pressable key={item} onPress={() => setScope(item)} style={{ flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: scope === item ? C.teal : C.line, backgroundColor: C.panel2 }}><Text style={{ textAlign: 'center', color: scope === item ? C.teal : C.muted, fontWeight: '800' }}>{item === 'institution' ? 'Institution' : 'One document'}</Text></Pressable>)}</View>
      {scope === 'document' ? <View style={{ gap: 8 }}><Text style={styles.label}>Selected matter</Text>{docs.map(doc => <Pressable key={doc.id} onPress={() => setDocumentId(doc.id)} style={{ padding: 11, borderRadius: 12, borderWidth: 1, borderColor: documentId === doc.id ? C.teal : C.line, backgroundColor: C.panel2 }}><Text style={{ color: C.text, fontWeight: '700' }}>{doc.title}</Text><Text style={{ color: C.muted, fontSize: 11 }}>{doc.jurisdiction || '—'}</Text></Pressable>)}</View> : null}
      <Text style={styles.label}>Reasoning mode</Text><View style={{ flexDirection: 'row', gap: 7 }}>{modes.map(item => <Pressable key={item} onPress={() => setMode(item)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: mode === item ? C.blue : C.line, backgroundColor: C.panel2 }}><Text style={{ color: mode === item ? C.blue : C.muted, textAlign: 'center', fontSize: 11, fontWeight: '800' }}>{item}</Text></Pressable>)}</View>
      <TextInput multiline value={question} onChangeText={setQuestion} style={styles.textarea} placeholder="Ask SYNESIS…" placeholderTextColor={C.muted} />
      {error ? <Text style={{ color: C.red }}>{error}</Text> : null}
      <Action title={busy ? 'Reasoning…' : 'Run governed analysis'} onPress={run} disabled={busy || !question.trim()} />
    </Card>
    {busy ? <ActivityIndicator color={C.teal} /> : null}
    {answer ? <Card style={{ gap: 10 }}><View style={styles.between}><Pill value={answer.deterministic?.riskLevel || 'Decision support'} /><Muted>{answer.mode?.effective || mode}</Muted></View><Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{answer.governor?.disposition || 'Governed result'}</Text><Text style={{ color: C.text, lineHeight: 21 }}>{answer.intelligence?.answer || 'No external model output was used; deterministic governance result returned.'}</Text><View style={styles.divider} /><Muted>External research: {answer.informationFlow?.externalResearchAllowed ? 'permitted' : 'constrained'} · Human approval: {answer.governor?.required ? 'required' : 'not triggered'} · Cross-matter memory: {answer.scope?.crossMatterMemoryUsed ? 'used' : 'excluded'}</Muted>{(answer.intelligence?.citations || []).slice(0, 8).map((c: any, index: number) => <Text key={`${c.url}-${index}`} style={{ color: C.blue, fontSize: 12 }}>{c.title || c.url}</Text>)}</Card> : null}
  </ScrollView></Screen>;
}
