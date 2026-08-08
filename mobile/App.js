import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthAPI, SynesisAPI, API_BASE } from './src/api';

const tabs = ['Neuro', 'Matters', 'Brain', 'Work', 'Settings'];

const palette = {
  light: {
    bg: '#F4F7FB', card: '#FFFFFF', card2: '#F8FAFC', text: '#0D1B2A', muted: '#617386',
    line: '#DCE5EE', brand: '#0B315A', brand2: '#164F86', accent: '#1A73E8', good: '#137A4A',
    warn: '#A25A00', danger: '#B3261E', chip: '#EEF4FA'
  },
  dark: {
    bg: '#07101B', card: '#0E1A28', card2: '#122234', text: '#F4F8FC', muted: '#9BAFC2',
    line: '#23364A', brand: '#75B8FF', brand2: '#3E8BD3', accent: '#75B8FF', good: '#57D395',
    warn: '#F5B85A', danger: '#FF7B72', chip: '#13283C'
  }
};

function riskColor(level, c) {
  const value = String(level || '').toLowerCase();
  if (value.includes('critical') || value.includes('high')) return c.danger;
  if (value.includes('medium') || value.includes('attention')) return c.warn;
  if (value.includes('low') || value.includes('verified') || value.includes('live')) return c.good;
  return c.muted;
}

function metricValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

export default function App() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = palette[scheme];
  const [session, setSession] = useState(null);
  const [boot, setBoot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Neuro');
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState('');

  async function hydrate() {
    try {
      const data = await SynesisAPI.bootstrap();
      setBoot(data);
      setSession(data.user);
      if (!selectedId && data.documents?.[0]) setSelectedId(data.documents[0].id);
    } catch (error) {
      if (error.status === 401) setSession(null);
      else setNotice(error.message);
    }
  }

  async function start() {
    setLoading(true);
    try {
      const result = await AuthAPI.session();
      setSession(result.user);
      if (!result.user.mustChangePassword) await hydrate();
    } catch {
      setSession(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { start(); }, []);
  useEffect(() => {
    if (!selectedId || !session || session.mustChangePassword) return;
    SynesisAPI.document(selectedId).then(data => setSelected(data.document)).catch(() => setSelected(null));
  }, [selectedId, session?.id]);

  if (loading) return <Splash c={c} />;
  if (!session) return <Login c={c} onLogin={async user => { setSession(user); if (!user.mustChangePassword) await hydrate(); }} />;
  if (session.mustChangePassword) return <PasswordSetup c={c} user={session} onDone={async user => { setSession(user); await hydrate(); }} onLogout={() => setSession(null)} />;
  if (!boot) return <Splash c={c} label="Loading institutional intelligence…" />;

  const common = { c, boot, hydrate, selectedId, setSelectedId, selected, setSelected, setTab, setUploadOpen, setNotice };

  return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
    <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
    <View style={styles.root}>
      <View style={[styles.topbar, { borderBottomColor: c.line }]}> 
        <View>
          <Text style={[styles.brand, { color: c.text }]}>SYNESIS</Text>
          <Text style={[styles.kicker, { color: c.muted }]}>Neuro Intelligence · iOS</Text>
        </View>
        <Pressable style={[styles.actionSmall, { backgroundColor: c.brand }]} onPress={() => setUploadOpen(true)}>
          <Text style={styles.actionSmallText}>Analyse</Text>
        </Pressable>
      </View>

      {notice ? <Pressable onPress={() => setNotice('')} style={[styles.notice, { backgroundColor: c.chip, borderColor: c.line }]}><Text style={{ color: c.text }}>{notice}</Text></Pressable> : null}

      <View style={styles.body}>
        {tab === 'Neuro' && <NeuroScreen {...common} />}
        {tab === 'Matters' && <MattersScreen {...common} />}
        {tab === 'Brain' && <BrainScreen {...common} />}
        {tab === 'Work' && <WorkScreen {...common} />}
        {tab === 'Settings' && <SettingsScreen {...common} user={session} onLogout={async () => { try { await AuthAPI.logout(); } catch {} setBoot(null); setSession(null); }} />}
      </View>

      <View style={[styles.tabs, { backgroundColor: c.card, borderTopColor: c.line }]}> 
        {tabs.map(item => <Pressable key={item} style={styles.tab} onPress={() => setTab(item)}>
          <Text style={[styles.tabLabel, { color: tab === item ? c.accent : c.muted, fontWeight: tab === item ? '800' : '600' }]}>{item}</Text>
          {tab === item ? <View style={[styles.tabDot, { backgroundColor: c.accent }]} /> : null}
        </Pressable>)}
      </View>
    </View>

    <UploadSheet visible={uploadOpen} c={c} onClose={() => setUploadOpen(false)} onComplete={({ document, state }) => {
      setUploadOpen(false);
      setBoot(current => ({ ...current, state, documents: [document, ...(current.documents || []).filter(d => d.id !== document.id)] }));
      setSelectedId(document.id);
      setSelected(document);
      setTab('Matters');
      setNotice(`${document.title} analysed and opened as an independent matter.`);
    }} />
  </SafeAreaView>;
}

function Splash({ c, label = 'Connecting to SYNESIS…' }) {
  return <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}><LinearGradient colors={[c.brand, c.brand2]} style={styles.logo}><Text style={styles.logoText}>S</Text></LinearGradient><Text style={[styles.splashTitle, { color: c.text }]}>SYNESIS</Text><ActivityIndicator color={c.accent} /><Text style={[styles.splashSub, { color: c.muted }]}>{label}</Text></SafeAreaView>;
}

function Login({ c, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try { const data = await AuthAPI.login(email.trim(), password); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await onLogin(data.user); }
    catch (e) { setError(e.message); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={[styles.authWrap, { backgroundColor: c.bg }]}><ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
    <LinearGradient colors={[c.brand, c.brand2]} style={styles.logo}><Text style={styles.logoText}>S</Text></LinearGradient>
    <Text style={[styles.authEyebrow, { color: c.accent }]}>SYNESIS NEURO INTELLIGENCE</Text>
    <Text style={[styles.authTitle, { color: c.text }]}>Institutional intelligence in your hand.</Text>
    <Text style={[styles.authCopy, { color: c.muted }]}>Documents, current law, exposure, decisions and governed AI in one mobile workspace.</Text>
    <View style={[styles.authCard, { backgroundColor: c.card, borderColor: c.line }]}> 
      <Field label="Email" value={email} onChangeText={setEmail} c={c} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} c={c} secureTextEntry />
      {error ? <Text style={{ color: c.danger, marginBottom: 10 }}>{error}</Text> : null}
      <Primary title={busy ? 'Signing in…' : 'Enter SYNESIS'} c={c} onPress={submit} disabled={busy || !email || !password} />
    </View>
  </ScrollView></SafeAreaView>;
}

function PasswordSetup({ c, user, onDone, onLogout }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try { const data = await AuthAPI.changePassword(currentPassword, newPassword); await onDone(data.user); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <SafeAreaView style={[styles.authWrap, { backgroundColor: c.bg }]}><ScrollView contentContainerStyle={styles.authContent}>
    <Text style={[styles.authEyebrow, { color: c.accent }]}>FIRST LOGIN SECURITY</Text>
    <Text style={[styles.authTitle, { color: c.text }]}>Secure {user.name}'s account.</Text>
    <View style={[styles.authCard, { backgroundColor: c.card, borderColor: c.line }]}>
      <Field label="Temporary password" value={currentPassword} onChangeText={setCurrent} c={c} secureTextEntry />
      <Field label="New permanent password" value={newPassword} onChangeText={setNext} c={c} secureTextEntry />
      {error ? <Text style={{ color: c.danger, marginBottom: 10 }}>{error}</Text> : null}
      <Primary title={busy ? 'Securing…' : 'Secure account'} c={c} onPress={submit} disabled={busy || !currentPassword || newPassword.length < 12} />
      <Pressable onPress={onLogout}><Text style={[styles.link, { color: c.accent }]}>Sign out</Text></Pressable>
    </View>
  </ScrollView></SafeAreaView>;
}

function NeuroScreen({ c, boot, hydrate, selected, selectedId, setSelectedId, setTab, setUploadOpen, setNotice }) {
  const [refreshing, setRefreshing] = useState(false);
  const state = boot.state || {};
  const metrics = state.metrics || {};
  const findings = (selected?.analysis?.findings || []).filter(x => ['Critical','High','Medium'].includes(x.risk_level || x.risk || x.severity));
  async function refresh() { setRefreshing(true); try { await hydrate(); } finally { setRefreshing(false); } }
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />} contentContainerStyle={styles.scroll}>
    <LinearGradient colors={[c.brand, c.brand2]} style={styles.hero}>
      <Text style={styles.heroEyebrow}>CENTRAL INTELLIGENCE</Text>
      <Text style={styles.heroTitle}>One brain for evidence, law, exposure and action.</Text>
      <Text style={styles.heroCopy}>Upload a real document, isolate the matter, verify current law, quantify only defensible exposure and keep consequential decisions behind governed controls.</Text>
      <View style={styles.heroActions}><Pressable onPress={() => setUploadOpen(true)} style={styles.heroButton}><Text style={styles.heroButtonText}>Analyse document</Text></Pressable><Pressable onPress={() => setTab('Brain')} style={styles.heroGhost}><Text style={styles.heroGhostText}>Ask Brain</Text></Pressable></View>
    </LinearGradient>

    <View style={styles.metricGrid}>
      <Metric c={c} label="Matters" value={boot.documents?.length || 0} note="independent sources" />
      <Metric c={c} label="Attention" value={metrics.attention || 0} note="risks / decisions" />
      <Metric c={c} label="Live changes" value={metrics.liveChanges24h || metrics.liveChanges || 0} note="regulatory pulse" />
      <Metric c={c} label="Graph" value={state.graph?.nodes?.length || 0} note="linked nodes" />
    </View>

    <SectionTitle c={c} title="Current matter" action="All matters" onAction={() => setTab('Matters')} />
    {selected ? <Card c={c}>
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: c.text }]}>{selected.title}</Text><Text style={[styles.meta, { color: c.muted }]}>{selected.matter || 'General review'} · {selected.jurisdiction || '—'}</Text></View><Risk value={selected.analysis?.overall_risk || selected.overallRisk} c={c} /></View>
      <Text style={[styles.bodyText, { color: c.text }]} numberOfLines={5}>{selected.analysis?.document_summary || selected.analysis?.summary || 'Independent matter analysis.'}</Text>
      <View style={styles.chipRow}><Chip c={c} text={`${findings.length} material findings`} /><Chip c={c} text={selected.analysis?.analysis_details?.current_law_web_used ? 'Current-law checked' : 'Current-law status unavailable'} /></View>
      <Primary c={c} title="Open matter" onPress={() => setTab('Matters')} />
    </Card> : <Empty c={c} title="No matter selected" text="Analyse a document to create your first independent matter." action="Analyse document" onAction={() => setUploadOpen(true)} />}

    <SectionTitle c={c} title="Attention now" />
    {(state.alerts || []).slice(0, 5).map(item => <Card c={c} key={item.id}><View style={styles.rowBetween}><Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>{item.title}</Text><Risk value={item.severity} c={c} /></View><Text style={[styles.meta, { color: c.muted }]}>{item.owner || 'Owner not assigned'} · {item.due || 'No due date'}</Text><Text style={[styles.bodyText, { color: c.text }]}>{item.why || item.next || ''}</Text></Card>)}
  </ScrollView>;
}

function MattersScreen({ c, boot, selectedId, setSelectedId, selected, setSelected, setUploadOpen, setNotice }) {
  const [query, setQuery] = useState('');
  const [ask, setAsk] = useState('What are the most material current legal risks in this document and what should be changed?');
  const [answer, setAnswer] = useState(null);
  const [exposure, setExposure] = useState(null);
  const [busy, setBusy] = useState(false);
  const docs = (boot.documents || []).filter(d => !query.trim() || [d.title,d.matter,d.jurisdiction].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const findings = (selected?.analysis?.findings || []).filter(x => ['Critical','High','Medium'].includes(x.risk_level || x.risk || x.severity));
  async function open(id) { setSelectedId(id); setAnswer(null); setExposure(null); try { const data = await SynesisAPI.document(id); setSelected(data.document); } catch (e) { setNotice(e.message); } }
  async function askDoc() { if (!selectedId) return; setBusy(true); try { setAnswer(await SynesisAPI.askDocument(selectedId, ask)); } catch (e) { setNotice(e.message); } finally { setBusy(false); } }
  async function quantify() { if (!selectedId) return; setBusy(true); try { setExposure(await SynesisAPI.exposure(selectedId)); } catch (e) { setNotice(e.message); } finally { setBusy(false); } }
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <View style={styles.headingRow}><View><Text style={[styles.screenTitle, { color: c.text }]}>Matters</Text><Text style={[styles.kicker, { color: c.muted }]}>Independent evidence. No cross-document contamination.</Text></View><Pressable onPress={() => setUploadOpen(true)}><Text style={[styles.link, { color: c.accent }]}>+ Analyse</Text></Pressable></View>
    <TextInput value={query} onChangeText={setQuery} placeholder="Search matters" placeholderTextColor={c.muted} style={[styles.search, { color: c.text, backgroundColor: c.card, borderColor: c.line }]} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>{docs.map(doc => <Pressable key={doc.id} onPress={() => open(doc.id)} style={[styles.matterPill, { backgroundColor: selectedId === doc.id ? c.brand : c.card, borderColor: selectedId === doc.id ? c.brand : c.line }]}><Text numberOfLines={1} style={{ color: selectedId === doc.id ? '#fff' : c.text, fontWeight: '700', maxWidth: 180 }}>{doc.title}</Text><Text style={{ color: selectedId === doc.id ? '#DCEEFF' : c.muted, fontSize: 11 }}>{doc.overallRisk || doc.analysis?.overall_risk || 'Unrated'}</Text></Pressable>)}</ScrollView>

    {selected ? <>
      <Card c={c}><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: c.text }]}>{selected.title}</Text><Text style={[styles.meta, { color: c.muted }]}>{selected.matter || 'General review'} · {selected.documentType || 'Document'} · {selected.jurisdiction || '—'}</Text></View><Risk value={selected.analysis?.overall_risk || selected.overallRisk} c={c} /></View><Text style={[styles.bodyText, { color: c.text }]}>{selected.analysis?.executive_position || selected.analysis?.document_summary || selected.analysis?.summary || 'Analysis available.'}</Text><View style={styles.chipRow}><Chip c={c} text={`Score ${metricValue(selected.analysis?.overall_score ?? selected.score)}/100`} /><Chip c={c} text={selected.analysis?.analysis_details?.current_law_web_used ? 'Live law used' : 'Live law not recorded'} /></View></Card>
      <SectionTitle c={c} title={`Material findings (${findings.length})`} />
      {findings.slice(0, 12).map((item, index) => <Card c={c} key={item.id || index}><View style={styles.rowBetween}><Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>{item.issue || item.title || item.category}</Text><Risk value={item.risk_level || item.risk || item.severity} c={c} /></View><Text style={[styles.meta, { color: c.muted }]}>{item.clause_reference || item.clause_label || item.category || 'Document-wide'}</Text>{item.quoted_text || item.evidence ? <Text style={[styles.quote, { color: c.text, borderLeftColor: c.line }]}>{item.quoted_text || item.evidence}</Text> : null}<Text style={[styles.bodyText, { color: c.text }]}>{item.institutional_impact || item.recommendation || item.mitigation || ''}</Text></Card>)}

      <SectionTitle c={c} title="Ask this document" />
      <Card c={c}><TextInput multiline value={ask} onChangeText={setAsk} placeholderTextColor={c.muted} style={[styles.textarea, { color: c.text, borderColor: c.line, backgroundColor: c.card2 }]} /><View style={styles.buttonRow}><Primary c={c} title={busy ? 'Working…' : 'Ask with current law'} onPress={askDoc} disabled={busy} flex /><Secondary c={c} title="Exposure" onPress={quantify} disabled={busy} flex /></View>{answer ? <AnswerBlock c={c} answer={answer.answer || answer.live?.answer || 'No answer returned.'} citations={answer.live?.citations || answer.citations || []} /> : null}</Card>
      {exposure?.exposure ? <><SectionTitle c={c} title="Exposure" />{(exposure.exposure.exposures || []).map(item => <Card c={c} key={item.findingId}><View style={styles.rowBetween}><Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>{item.issue || item.category}</Text><Risk value={item.riskLevel} c={c} /></View><Text style={[styles.exposure, { color: c.text }]}>{item.exposureLabel}</Text><Text style={[styles.bodyText, { color: c.muted }]}>{item.rationale}</Text><Text style={[styles.meta, { color: c.muted }]}>{item.quantificationStatus} · confidence {item.confidence}%</Text></Card>)}</> : null}
    </> : <Empty c={c} title="No selected matter" text="Choose a matter above or analyse a new document." action="Analyse" onAction={() => setUploadOpen(true)} />}
  </ScrollView>;
}

function BrainScreen({ c, boot, selectedId, setNotice }) {
  const [scope, setScope] = useState(selectedId ? 'document' : 'institution');
  const [mode, setMode] = useState('governed');
  const [question, setQuestion] = useState('What changed, what matters, what is the defensible exposure, and what should we do next?');
  const [jurisdiction, setJurisdiction] = useState('India');
  const [result, setResult] = useState(null);
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { SynesisAPI.liveStatus().then(setLive).catch(() => {}); }, []);
  async function run() {
    setBusy(true); setResult(null);
    try {
      const data = await SynesisAPI.cognitiveRun({ question, mode, dataClass: 'internal', jurisdiction, scope: scope === 'document' ? `document:${selectedId}` : 'institution', documentId: scope === 'document' ? selectedId : undefined });
      setResult(data);
    } catch (e) { setNotice(e.message); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <Text style={[styles.screenTitle, { color: c.text }]}>Live Brain</Text><Text style={[styles.kicker, { color: c.muted }]}>Natural-language reasoning with deterministic information-flow controls.</Text>
    <Card c={c}><View style={styles.segment}><Segment c={c} active={scope === 'document'} label="One document" onPress={() => setScope('document')} disabled={!selectedId} /><Segment c={c} active={scope === 'institution'} label="Institution" onPress={() => setScope('institution')} /></View><View style={styles.segment}><Segment c={c} active={mode === 'governed'} label="Governed" onPress={() => setMode('governed')} /><Segment c={c} active={mode === 'probabilistic'} label="Probabilistic" onPress={() => setMode('probabilistic')} /><Segment c={c} active={mode === 'deterministic'} label="Deterministic" onPress={() => setMode('deterministic')} /></View><Field c={c} label="Jurisdiction" value={jurisdiction} onChangeText={setJurisdiction} /><TextInput multiline value={question} onChangeText={setQuestion} style={[styles.textarea, { color: c.text, borderColor: c.line, backgroundColor: c.card2 }]} /><Primary c={c} title={busy ? 'Reasoning…' : 'Run governed analysis'} onPress={run} disabled={busy || (scope === 'document' && !selectedId)} />{result ? <><View style={styles.chipRow}><Chip c={c} text={result.deterministic?.riskLevel || 'Unrated'} /><Chip c={c} text={result.mode?.effective || mode} /><Chip c={c} text={result.governor?.required ? 'Human approval required' : 'Decision support'} /></View><AnswerBlock c={c} answer={result.intelligence?.answer || result.governor?.disposition || 'Deterministic result returned without external model output.'} citations={result.intelligence?.citations || []} />{result.probabilistic?.distribution ? <View style={{ marginTop: 12 }}>{Object.entries(result.probabilistic.distribution).map(([name, value]) => <View key={name} style={styles.probRow}><Text style={[styles.meta, { color: c.text, flex: 1 }]}>{name}</Text><Text style={[styles.meta, { color: c.muted }]}>{Math.round(Number(value) * 100)}%</Text></View>)}</View> : null}</> : null}</Card>

    <SectionTitle c={c} title="Regulatory pulse" />
    {(live?.latest || []).slice(0, 10).map(item => <Card c={c} key={item.id}><View style={styles.rowBetween}><Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>{item.title}</Text><Risk value={item.severity} c={c} /></View><Text style={[styles.meta, { color: c.muted }]}>{item.regulator || item.authority} · {item.jurisdiction} · {item.changeType || item.change_type || 'Observed'}</Text><Text style={[styles.bodyText, { color: c.text }]}>{item.summary || item.context || 'Official-source event detected.'}</Text></Card>)}
  </ScrollView>;
}

function WorkScreen({ c, boot }) {
  const state = boot.state || {};
  const tasks = state.tasks || [];
  return <ScrollView contentContainerStyle={styles.scroll}><Text style={[styles.screenTitle, { color: c.text }]}>Work</Text><Text style={[styles.kicker, { color: c.muted }]}>Owned actions, obligations and decisions.</Text><SectionTitle c={c} title={`Tasks (${tasks.length})`} />{tasks.slice(0, 30).map(item => <Card c={c} key={item.id}><View style={styles.rowBetween}><Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>{item.title}</Text><Risk value={item.priority} c={c} /></View><Text style={[styles.meta, { color: c.muted }]}>{item.owner || 'Unassigned'} · {item.status || 'Not started'}</Text><Text style={[styles.bodyText, { color: c.text }]}>{item.blocker || (item.evidenceRequired || []).join(' · ') || 'No blocker recorded.'}</Text></Card>)}<SectionTitle c={c} title="Pending decisions" />{(state.decisions || []).filter(d => !['Approved','Rejected','Closed'].includes(d.status)).slice(0, 20).map(item => <Card c={c} key={item.id}><View style={styles.rowBetween}><Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>{item.title}</Text><Risk value={item.risk} c={c} /></View><Text style={[styles.meta, { color: c.muted }]}>{item.owner || 'Decision owner'} · {item.status}</Text><Text style={[styles.bodyText, { color: c.text }]}>{item.rationale || ''}</Text></Card>)}</ScrollView>;
}

function SettingsScreen({ c, user, onLogout, setNotice }) {
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(false);
  async function refresh() { setLoading(true); try { setControl(await SynesisAPI.controlPlane()); } catch (e) { setNotice(e.message); } finally { setLoading(false); } }
  useEffect(() => { refresh(); }, []);
  const policy = control?.controls || {};
  return <ScrollView contentContainerStyle={styles.scroll}><Text style={[styles.screenTitle, { color: c.text }]}>Settings</Text><Card c={c}><Text style={[styles.cardTitle, { color: c.text }]}>{user.name}</Text><Text style={[styles.meta, { color: c.muted }]}>{user.email} · {user.role}</Text></Card><SectionTitle c={c} title="Cognitive controls" action="Refresh" onAction={refresh} /><Card c={c}>{loading ? <ActivityIndicator color={c.accent} /> : <><SettingRow c={c} label="Safe mode" value={policy.safeMode === false ? 'Off' : 'On'} /><SettingRow c={c} label="Kill switch" value={policy.killSwitch ? 'ACTIVE' : 'Ready'} danger={policy.killSwitch} /><SettingRow c={c} label="External research" value={policy.externalResearch === false ? 'Blocked' : 'Policy-controlled'} /><SettingRow c={c} label="External models" value={policy.externalModels === false ? 'Blocked' : 'Policy-controlled'} /><SettingRow c={c} label="Memory promotion" value={policy.allowMemoryPromotion ? 'Policy-authorised' : 'Manual approval'} /></>}</Card><SectionTitle c={c} title="Connectivity" /><Card c={c}><SettingRow c={c} label="Backend" value={API_BASE.replace('/api','')} /><SettingRow c={c} label="Product" value="SYNESIS Neuro Intelligence" /><SettingRow c={c} label="Mobile client" value="iOS v1" /></Card><Secondary c={c} title="Sign out" onPress={onLogout} /></ScrollView>;
}

function UploadSheet({ visible, c, onClose, onComplete }) {
  const [asset, setAsset] = useState(null);
  const [title, setTitle] = useState('');
  const [matter, setMatter] = useState('');
  const [jurisdiction, setJurisdiction] = useState('India');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function choose() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv','application/json','application/xml','text/xml','text/markdown','text/html','application/rtf'], copyToCacheDirectory: true, multiple: false });
    if (!result.canceled && result.assets?.[0]) { setAsset(result.assets[0]); if (!title) setTitle(String(result.assets[0].name || '').replace(/\.[^.]+$/, '')); }
  }
  async function submit() {
    if (!asset) { setError('Choose a document first.'); return; }
    setBusy(true); setError('');
    try { const data = await SynesisAPI.analyzeDocument({ asset, title, matter, jurisdiction }); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete(data); setAsset(null); setTitle(''); setMatter(''); }
    catch (e) { setError(e.message); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    finally { setBusy(false); }
  }
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}><ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled"><View style={styles.rowBetween}><View><Text style={[styles.screenTitle, { color: c.text }]}>Analyse document</Text><Text style={[styles.kicker, { color: c.muted }]}>Single-document isolation is enforced.</Text></View><Pressable onPress={onClose}><Text style={[styles.link, { color: c.accent }]}>Close</Text></Pressable></View><Pressable onPress={choose} style={[styles.drop, { backgroundColor: c.card, borderColor: c.line }]}><Text style={[styles.dropTitle, { color: c.text }]}>{asset ? asset.name : 'Choose from Files'}</Text><Text style={[styles.meta, { color: c.muted }]}>PDF, DOCX, TXT, CSV, JSON, Markdown, XML, HTML or RTF</Text></Pressable><Field c={c} label="Title (optional)" value={title} onChangeText={setTitle} /><Field c={c} label="Matter (optional)" value={matter} onChangeText={setMatter} placeholder="Vendor agreement, policy, dispute…" /><Field c={c} label="Jurisdiction" value={jurisdiction} onChangeText={setJurisdiction} /><View style={[styles.guard, { backgroundColor: c.chip, borderColor: c.line }]}><Text style={{ color: c.text, fontWeight: '800' }}>Analysis controls</Text><Text style={[styles.meta, { color: c.muted }]}>Other documents are excluded from this run. Current-law research is attempted against authoritative sources. Unsupported monetary exposure is not invented. Corporate DLP controls are never bypassed.</Text></View>{error ? <Text style={{ color: c.danger }}>{error}</Text> : null}<Primary c={c} title={busy ? 'Analysing…' : 'Run independent analysis'} onPress={submit} disabled={busy || !asset} /></ScrollView></SafeAreaView></Modal>;
}

function Field({ label, c, ...props }) { return <View style={{ marginBottom: 12 }}><Text style={[styles.fieldLabel, { color: c.muted }]}>{label}</Text><TextInput {...props} placeholderTextColor={c.muted} style={[styles.input, { color: c.text, backgroundColor: c.card2, borderColor: c.line }]} /></View>; }
function Primary({ title, c, onPress, disabled, flex }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.primary, { backgroundColor: c.brand, opacity: disabled ? .5 : 1, flex: flex ? 1 : undefined }]}><Text style={styles.primaryText}>{title}</Text></Pressable>; }
function Secondary({ title, c, onPress, disabled, flex }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.secondary, { borderColor: c.line, backgroundColor: c.card, opacity: disabled ? .5 : 1, flex: flex ? 1 : undefined }]}><Text style={[styles.secondaryText, { color: c.text }]}>{title}</Text></Pressable>; }
function Card({ c, children }) { return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>{children}</View>; }
function Metric({ c, label, value, note }) { return <View style={[styles.metric, { backgroundColor: c.card, borderColor: c.line }]}><Text style={[styles.metricLabel, { color: c.muted }]}>{label}</Text><Text style={[styles.metricNumber, { color: c.text }]}>{metricValue(value)}</Text><Text style={[styles.meta, { color: c.muted }]}>{note}</Text></View>; }
function Risk({ value, c }) { return <View style={[styles.risk, { borderColor: riskColor(value,c) }]}><Text style={{ color: riskColor(value,c), fontWeight: '800', fontSize: 11 }}>{value || 'Unrated'}</Text></View>; }
function Chip({ c, text }) { return <View style={[styles.chip, { backgroundColor: c.chip }]}><Text style={{ color: c.muted, fontWeight: '700', fontSize: 11 }}>{text}</Text></View>; }
function SectionTitle({ c, title, action, onAction }) { return <View style={styles.sectionTitle}><Text style={[styles.sectionText, { color: c.text }]}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={[styles.link, { color: c.accent }]}>{action}</Text></Pressable> : null}</View>; }
function Empty({ c, title, text, action, onAction }) { return <Card c={c}><Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text><Text style={[styles.bodyText, { color: c.muted }]}>{text}</Text>{action ? <Primary title={action} c={c} onPress={onAction} /> : null}</Card>; }
function AnswerBlock({ c, answer, citations = [] }) { return <View style={[styles.answer, { backgroundColor: c.card2, borderColor: c.line }]}><Text style={[styles.bodyText, { color: c.text, marginTop: 0 }]}>{answer}</Text>{citations.slice(0, 8).map((source,index) => <Text key={`${source.url}-${index}`} numberOfLines={2} style={[styles.source, { color: c.accent }]}>{index + 1}. {source.title || source.url}</Text>)}</View>; }
function Segment({ c, active, label, onPress, disabled }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.segmentButton, { backgroundColor: active ? c.brand : c.card2, borderColor: active ? c.brand : c.line, opacity: disabled ? .45 : 1 }]}><Text style={{ color: active ? '#fff' : c.text, fontWeight: '700', fontSize: 12 }}>{label}</Text></Pressable>; }
function SettingRow({ c, label, value, danger }) { return <View style={[styles.settingRow, { borderBottomColor: c.line }]}><Text style={[styles.meta, { color: c.muted }]}>{label}</Text><Text numberOfLines={2} style={{ color: danger ? c.danger : c.text, fontWeight: '700', maxWidth: '62%', textAlign: 'right' }}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, root: { flex: 1 }, body: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#fff', fontWeight: '900', fontSize: 28 },
  splashTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 2 }, splashSub: { fontSize: 13 },
  authWrap: { flex: 1 }, authContent: { padding: 24, paddingTop: 56, gap: 14 }, authEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginTop: 12 }, authTitle: { fontSize: 36, fontWeight: '900', lineHeight: 41 }, authCopy: { fontSize: 16, lineHeight: 23 }, authCard: { borderWidth: 1, borderRadius: 22, padding: 18, marginTop: 12 },
  topbar: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth }, brand: { fontSize: 19, fontWeight: '900', letterSpacing: 1.2 }, kicker: { fontSize: 11, marginTop: 2 },
  actionSmall: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11 }, actionSmallText: { color: '#fff', fontWeight: '800', fontSize: 13 }, notice: { marginHorizontal: 14, marginTop: 8, padding: 11, borderRadius: 12, borderWidth: 1 },
  tabs: { height: 62, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row' }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 }, tabLabel: { fontSize: 11 }, tabDot: { width: 18, height: 3, borderRadius: 3 },
  scroll: { padding: 14, paddingBottom: 30 }, hero: { borderRadius: 24, padding: 20, marginBottom: 14 }, heroEyebrow: { color: '#CFE8FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: '#fff', fontWeight: '900', fontSize: 27, lineHeight: 32, marginTop: 8 }, heroCopy: { color: '#E4F1FF', fontSize: 14, lineHeight: 20, marginTop: 9 }, heroActions: { flexDirection: 'row', gap: 8, marginTop: 18 }, heroButton: { backgroundColor: '#fff', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 14 }, heroButtonText: { color: '#0B315A', fontWeight: '900' }, heroGhost: { borderWidth: 1, borderColor: '#8FC6F7', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 14 }, heroGhostText: { color: '#fff', fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48.8%', borderRadius: 16, padding: 14, borderWidth: 1 }, metricLabel: { fontSize: 11, fontWeight: '700' }, metricNumber: { fontSize: 26, fontWeight: '900', marginVertical: 4 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 9 }, sectionText: { fontSize: 17, fontWeight: '900' }, link: { fontSize: 13, fontWeight: '800', marginVertical: 10 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 9 }, cardTitle: { fontSize: 15, fontWeight: '850' }, meta: { fontSize: 11, lineHeight: 16 }, bodyText: { fontSize: 13, lineHeight: 19, marginTop: 9 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 11 }, chip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 }, risk: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, screenTitle: { fontSize: 27, fontWeight: '900' }, search: { borderWidth: 1, borderRadius: 13, height: 44, paddingHorizontal: 13, marginBottom: 12 }, matterPill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 }, quote: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 10, fontSize: 12, lineHeight: 18 }, exposure: { fontSize: 17, fontWeight: '900', marginTop: 10 },
  textarea: { minHeight: 112, borderWidth: 1, borderRadius: 13, padding: 12, textAlignVertical: 'top', marginBottom: 12 }, input: { height: 46, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1 }, fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 },
  primary: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, primaryText: { color: '#fff', fontWeight: '900', fontSize: 13 }, secondary: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, secondaryText: { fontWeight: '800', fontSize: 13 }, buttonRow: { flexDirection: 'row', gap: 8 },
  answer: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 12 }, source: { fontSize: 11, marginTop: 7 }, segment: { flexDirection: 'row', gap: 6, marginBottom: 10 }, segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1 }, probRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth }, sheet: { padding: 18, paddingBottom: 40 }, drop: { minHeight: 126, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginVertical: 18, padding: 18 }, dropTitle: { fontSize: 16, fontWeight: '900', marginBottom: 6, textAlign: 'center' }, guard: { padding: 13, borderRadius: 13, borderWidth: 1, marginVertical: 12 }
});
