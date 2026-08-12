import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SynesisAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Action, C, Card, Eyebrow, Muted, Pill, Screen, Title, styles } from '@/ui';

export default function NeuroHome() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [boot, status] = await Promise.allSettled([SynesisAPI.bootstrap(), SynesisAPI.liveStatus()]);
      if (boot.status === 'fulfilled') setData(boot.value);
      else throw boot.reason;
      if (status.status === 'fulfilled') setLive(status.value);
    } catch (e: any) { setError(e.message || 'SYNESIS could not refresh.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const state = data?.state || {};
  const docs = data?.documents || [];
  const metrics = state.metrics || {};
  const latest = live?.latest || [];
  const alerts = state.alerts || [];

  return <Screen><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.teal} />} contentContainerStyle={styles.content}>
    <View style={{ gap: 8 }}><Eyebrow>SYNESIS NEURO CORE</Eyebrow><Title>What changed. What matters. What you do next.</Title><Muted>{user?.name ? `${user.name} · ` : ''}Live legal, regulatory, risk and decision intelligence from the same governed brain.</Muted></View>
    {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}

    <Card style={{ gap: 12 }}>
      <View style={styles.between}><View style={{ flex: 1, gap: 4 }}><Eyebrow>PRIMARY ACTION</Eyebrow><Text style={styles.sectionTitle}>Give SYNESIS the evidence</Text><Muted>Upload a supported document or a PDF created with iPhone's document scanner. Analysis stays matter-isolated.</Muted></View><Pill value="Independent" /></View>
      <Action title="Analyse document" onPress={() => router.push('/analyse')} />
      <Action title="Open AI Control Tower" secondary onPress={() => router.push('/control')} />
    </Card>

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Card style={{ flex: 1 }}><Text style={styles.value}>{docs.length}</Text><Muted>Matters</Muted></Card>
      <Card style={{ flex: 1 }}><Text style={styles.value}>{metrics.attention ?? 0}</Text><Muted>Attention</Muted></Card>
    </View>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Card style={{ flex: 1 }}><Text style={styles.value}>{metrics.critical ?? 0}</Text><Muted>Critical</Muted></Card>
      <Card style={{ flex: 1 }}><Text style={styles.value}>{latest.length}</Text><Muted>Live changes</Muted></Card>
    </View>

    <View style={styles.between}><Text style={styles.sectionTitle}>Attention inbox</Text><Text style={{ color: C.teal, fontWeight: '800' }} onPress={() => router.push('/(tabs)/tasks')}>Open work</Text></View>
    {alerts.slice(0, 5).map((item: any) => <Card key={item.id} style={{ gap: 8 }}><View style={styles.between}><Pill value={item.severity} /><Muted>{item.owner || 'Unassigned'}</Muted></View><Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{item.title}</Text><Muted>{item.why || item.next || 'Review evidence and decide the governed next action.'}</Muted></Card>)}
    {!alerts.length ? <Card><Muted>No material alert is currently registered in the workspace.</Muted></Card> : null}

    <View style={styles.between}><Text style={styles.sectionTitle}>Live regulatory pulse</Text><Text style={{ color: C.teal, fontWeight: '800' }} onPress={() => router.push('/(tabs)/brain')}>Ask Brain</Text></View>
    {latest.slice(0, 5).map((item: any) => <Card key={item.id || item.eventId} style={{ gap: 7 }}><View style={styles.between}><Pill value={item.severity || item.changeType} /><Muted>{item.regulator || item.authority || 'Authority'}</Muted></View><Text style={{ color: C.text, fontWeight: '800' }}>{item.title}</Text><Muted>{item.summary || 'Primary-source change observed. Open Live Brain to establish applicability and legal effect.'}</Muted></Card>)}
    {!latest.length ? <Card><Muted>No source event is available yet. Pull to refresh when the service is awake.</Muted></Card> : null}

    <Action title="Sign out" secondary onPress={() => signOut().then(() => router.replace('/sign-in'))} />
  </ScrollView></Screen>;
}
