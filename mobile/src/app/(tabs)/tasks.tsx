import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SynesisAPI } from '@/lib/api';
import { C, Card, Muted, Pill, Screen, styles } from '@/ui';

const statuses = ['Not started', 'Ready', 'In progress', 'Blocked', 'Evidence review', 'Completed'];

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try { setTasks((await SynesisAPI.bootstrap()).state?.tasks || []); }
    catch (e: any) { setError(e.message || 'Could not load work.'); }
  }

  useEffect(() => { load(); }, []);

  async function advance(task: any) {
    const current = Math.max(0, statuses.indexOf(task.status));
    const next = statuses[Math.min(statuses.length - 1, current + 1)];
    if (next === task.status) return;
    try {
      const data = await SynesisAPI.patchTask(task.id, next);
      setTasks(data.state?.tasks || tasks.map(item => item.id === task.id ? { ...item, status: next } : item));
      await Haptics.selectionAsync();
    } catch (e: any) { setError(e.message || 'Task update failed.'); }
  }

  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View><Text style={styles.sectionTitle}>Owned work</Text><Muted>Obligations, remediation and evidence tasks generated from actual matters.</Muted></View>
    {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}
    {tasks.map(task => <Card key={task.id} style={{ gap: 9 }}><View style={styles.between}><Pill value={task.priority} /><Muted>{task.owner || 'Unassigned'}</Muted></View><Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{task.title}</Text><Muted>{task.blocker || task.source || 'Source-linked work item'}</Muted><View style={styles.between}><Text style={{ color: C.blue, fontWeight: '800', fontSize: 12 }}>{task.status}</Text><Pressable onPress={() => advance(task)}><Text style={{ color: C.teal, fontWeight: '800' }}>{task.status === 'Completed' ? 'Done' : 'Advance →'}</Text></Pressable></View></Card>)}
    {!tasks.length ? <Card><Muted>No open tasks are registered.</Muted></Card> : null}
  </ScrollView></Screen>;
}
