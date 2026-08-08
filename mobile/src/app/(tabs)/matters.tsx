import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SynesisAPI } from '@/lib/api';
import { Action, C, Card, Muted, Pill, Screen, styles } from '@/ui';

export default function Matters() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setDocs((await SynesisAPI.documents()).documents || []); }
    catch (e: any) { setError(e.message || 'Could not load matters.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.between}><View><Text style={styles.sectionTitle}>Independent matters</Text><Muted>Each document stays evidence-scoped unless you explicitly choose institutional analysis.</Muted></View></View>
    <Action title="New analysis" onPress={() => router.push('/analyse')} />
    {loading ? <ActivityIndicator color={C.teal} /> : null}
    {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}
    {docs.map(doc => <Pressable key={doc.id} onPress={() => router.push({ pathname: '/matter/[id]', params: { id: doc.id } })}><Card style={{ gap: 9 }}>
      <View style={styles.between}><Pill value={doc.overallRisk || doc.analysis?.overall_risk} /><Muted>{doc.jurisdiction || '—'}</Muted></View>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{doc.title}</Text>
      <Muted>{doc.matter || 'General review'} · {doc.documentType || 'Document'}</Muted>
      <Muted>{doc.engine || doc.analysis?.engine || 'SYNESIS'} · {doc.status || 'Analysed'}</Muted>
    </Card></Pressable>)}
    {!loading && !docs.length ? <Card><Muted>No matters yet. Analyse a document to create the first one.</Muted></Card> : null}
  </ScrollView></Screen>;
}
