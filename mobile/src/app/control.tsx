import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SynesisAPI } from '@/lib/api';
import { C, Card, Eyebrow, Muted, Pill, Screen, styles } from '@/ui';

export default function Control() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { SynesisAPI.controlPlane().then(setData).catch((e: any) => setError(e.message || 'Control state unavailable.')); }, []);
  const c = data?.controls || {};
  const s = data?.system || {};

  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View style={{ gap: 7 }}><Eyebrow>DETERMINISTIC GOVERNOR</Eyebrow><Text style={styles.sectionTitle}>The model reasons. Policy controls the boundaries.</Text><Muted>Information flow, model access, memory and consequential action remain controlled outside the probabilistic model.</Muted></View>
    {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}
    {!data && !error ? <ActivityIndicator color={C.teal} /> : null}
    {data ? <>
      <Card style={{ gap: 10 }}><View style={styles.between}><Text style={{ color: C.text, fontWeight: '800' }}>Safe mode</Text><Pill value={c.safeMode === false ? 'OFF' : 'ON'} /></View><View style={styles.between}><Muted>Kill switch</Muted><Pill value={c.killSwitch ? 'ACTIVE' : 'Ready'} /></View><View style={styles.between}><Muted>External AI models</Muted><Text style={{ color: C.text, fontWeight: '800' }}>{c.externalModels === false ? 'Blocked' : 'Policy-controlled'}</Text></View><View style={styles.between}><Muted>Live external research</Muted><Text style={{ color: C.text, fontWeight: '800' }}>{c.externalResearch === false ? 'Blocked' : 'Policy-controlled'}</Text></View><View style={styles.between}><Muted>Memory promotion</Muted><Text style={{ color: C.text, fontWeight: '800' }}>{c.allowMemoryPromotion ? 'Authorised workflow' : 'Manual only'}</Text></View></Card>
      <Card style={{ gap: 10 }}><Text style={styles.sectionTitle}>Runtime</Text><View style={styles.between}><Muted>Governor</Muted><Text style={{ color: C.text }}>{s.governor || 'deterministic'}</Text></View><View style={styles.between}><Muted>Probabilistic decisioning</Muted><Text style={{ color: C.text }}>{s.probabilisticDecisioning ? 'Enabled' : 'Disabled'}</Text></View><View style={styles.between}><Muted>Transient memory</Muted><Text style={{ color: C.text }}>{s.transientWorkingMemory ? 'Enabled' : 'Disabled'}</Text></View><View style={styles.between}><Muted>Graph</Muted><Text style={{ color: C.text }}>{s.graphNodes || 0} nodes · {s.graphEdges || 0} edges</Text></View><View style={styles.between}><Muted>Live authority research</Muted><Text style={{ color: C.text }}>{s.liveAuthorityResearch ? 'Available' : 'Unavailable / blocked'}</Text></View></Card>
      <Card><Muted>This mobile console is intentionally read-only for global AI control policy in v1. Policy changes remain an administrator action through the main Control Tower, preventing an accidental phone tap from weakening enterprise safeguards.</Muted></Card>
    </> : null}
  </ScrollView></Screen>;
}
