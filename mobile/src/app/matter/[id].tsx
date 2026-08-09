import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SynesisAPI } from '@/lib/api';
import { Action, C, Card, Eyebrow, Muted, Pill, Screen, styles } from '@/ui';

const sections = ['Decision', 'Clauses', 'Exposure', 'Graph', 'Brain', 'Law'] as const;
type SectionName = (typeof sections)[number];

function JsonBlock({ value }: { value: any }) {
  return <Text selectable style={{ color: C.muted, fontSize: 12, lineHeight: 18, fontFamily: 'Menlo' }}>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</Text>;
}

function DispositionList({ title, items }: { title: string; items?: any[] }) {
  if (!items?.length) return null;
  return <Card style={{ gap: 8 }}><Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{title}</Text>{items.map((item, index) => <View key={item.finding_id || item.findingId || index} style={{ gap: 3 }}><Text style={{ color: C.text, fontWeight: '800' }}>{item.issue || item.finding || item.title || item.finding_id || 'Finding'}</Text><Muted>{item.why || item.rationale || item.reason || 'No rationale returned.'}</Muted></View>)}</Card>;
}

export default function MatterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);
  const [section, setSection] = useState<SectionName>('Decision');
  const [decision, setDecision] = useState<any>(null);
  const [packs, setPacks] = useState<Record<string, any>>({});
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [exposure, setExposure] = useState<any>(null);
  const [question, setQuestion] = useState('What is genuinely worth raising in this exact document, what can be let go, and why?');
  const [answer, setAnswer] = useState<any>(null);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    if (!id) return;
    setError('');
    try {
      const [documentResult, healthResult, graphResult] = await Promise.allSettled([
        SynesisAPI.document(id), SynesisAPI.productHealth(), SynesisAPI.documentGraph(id)
      ]);
      if (documentResult.status === 'fulfilled') setDoc(documentResult.value.document);
      else throw documentResult.reason;
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
      if (graphResult.status === 'fulfilled') setGraph(graphResult.value);
    } catch (e: any) { setError(e.message || 'Matter could not be loaded.'); }
    finally { setBusy(''); }
  }

  useEffect(() => { load(); }, [id]);

  async function clearMatter() {
    if (!id) return;
    setBusy('decision'); setError(''); setNotice('');
    try { const data = await SynesisAPI.decisionPack(id); setDecision(data.decisionPack); }
    catch (e: any) { setError(e.message || 'Clearance decision failed.'); }
    finally { setBusy(''); }
  }

  async function assessFinding(finding: any, index: number) {
    if (!id) return;
    const findingId = String(finding.id || `finding-${index + 1}`);
    setBusy(`finding:${findingId}`); setError(''); setNotice('');
    try {
      const data = await SynesisAPI.findingActionPack(id, findingId, instructions[findingId] || '');
      setPacks(current => ({ ...current, [findingId]: data.actionPack }));
    } catch (e: any) { setError(e.message || 'Clause action pack failed.'); }
    finally { setBusy(''); }
  }

  async function saveMemory(finding: any, index: number) {
    if (!id) return;
    const findingId = String(finding.id || `finding-${index + 1}`);
    const pack = packs[findingId];
    if (!pack) return;
    setBusy(`memory:${findingId}`); setError('');
    try {
      await SynesisAPI.saveClauseMemory(id, findingId, pack);
      setNotice('Validated clause position saved to institutional memory.');
      const refreshed = await SynesisAPI.documentGraph(id);
      setGraph(refreshed);
    } catch (e: any) { setError(e.message || 'Clause memory save failed.'); }
    finally { setBusy(''); }
  }

  async function quantify() {
    if (!id) return;
    setBusy('exposure'); setError('');
    try { setExposure(await SynesisAPI.exposure(id)); }
    catch (e: any) { setError(e.message || 'Exposure analysis failed.'); }
    finally { setBusy(''); }
  }

  async function ask() {
    if (!id || !question.trim()) return;
    setBusy('ask'); setError('');
    try { setAnswer(await SynesisAPI.askDocument(id, question)); }
    catch (e: any) { setError(e.message || 'Document question failed.'); }
    finally { setBusy(''); }
  }

  if (busy === 'load' && !doc) return <Screen><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.teal} /></View></Screen>;
  const a = doc?.analysis || {};
  const findings = a.findings || [];
  const currentLaw = a.live_current_law || {};
  const liveModel = health?.runtimeSmoke?.neural;
  const liveResearch = health?.runtimeSmoke?.liveResearch;
  const exposureItems = exposure?.exposure?.exposures || a.exposure_model?.exposures || [];
  const graphNodes = graph?.graph?.nodes || a.document_graph?.nodes || [];
  const graphEdges = graph?.graph?.edges || a.document_graph?.edges || [];
  const memories = graph?.clauseMemory || a.clause_memory || [];

  const statusLine = useMemo(() => {
    if (!health) return 'Runtime status checking';
    return `Neural: ${liveModel?.status || 'unknown'} · Current-law web: ${liveResearch?.status || 'unknown'}`;
  }, [health, liveModel?.status, liveResearch?.status]);

  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {error ? <Card><Text style={{ color: C.red, lineHeight: 20 }}>{error}</Text>{liveModel?.error ? <Muted>{liveModel.error}</Muted> : null}</Card> : null}
    {notice ? <Card><Text style={{ color: C.teal, fontWeight: '800' }}>{notice}</Text></Card> : null}
    {doc ? <>
      <View style={{ gap: 7 }}><Eyebrow>ONE DOCUMENT · NO CROSS-MATTER MEMORY</Eyebrow><Text style={styles.title}>{doc.title}</Text><Muted>{doc.matter || 'General review'} · {doc.jurisdiction || '—'} · {doc.documentType || 'Document'}</Muted></View>
      <Card style={{ gap: 9 }}><View style={styles.between}><Pill value={a.overall_risk || doc.overallRisk} /><Text style={styles.value}>{a.overall_score ?? doc.score ?? '—'}<Text style={{ fontSize: 12, color: C.muted }}>/100</Text></Text></View><Text style={{ color: C.text, fontWeight: '800' }}>{statusLine}</Text><Muted>Analysis used live neural model: {a.analysis_details?.live_ai_used ? 'yes' : 'no'} · Current-law web: {a.analysis_details?.current_law_web_used ? 'yes' : 'no'}</Muted></Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{sections.map(item => <Pressable key={item} onPress={() => setSection(item)} style={{ borderWidth: 1, borderColor: section === item ? C.teal : C.line, backgroundColor: C.panel, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999 }}><Text style={{ color: section === item ? C.teal : C.muted, fontWeight: '800', fontSize: 12 }}>{item}</Text></Pressable>)}</ScrollView>

      {section === 'Decision' ? <>
        <Card style={{ gap: 10 }}><Eyebrow>MATTER CLEARANCE</Eyebrow><Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{a.recommended_decision || 'Run a fresh clearance decision.'}</Text><Text style={{ color: C.text, lineHeight: 21 }}>{a.executive_position || a.document_summary || ''}</Text><Action title={busy === 'decision' ? 'Re-evaluating…' : 'Can this matter be cleared?'} onPress={clearMatter} disabled={Boolean(busy)} /></Card>
        {decision ? <><Card style={{ gap: 9 }}><View style={styles.between}><Pill value={decision.overall_disposition} /><Muted>{decision.confidence ?? '—'}% confidence</Muted></View><Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{decision.clearance_recommendation}</Text><Text style={{ color: C.text, lineHeight: 21 }}>{decision.executive_rationale}</Text></Card><DispositionList title="Must fix" items={decision.must_fix}/><DispositionList title="Raise / negotiate" items={decision.raise_and_negotiate}/><DispositionList title="Accept with note" items={decision.acceptable_with_note}/><DispositionList title="Let go" items={decision.let_go}/><Card style={{ gap: 7 }}><Text style={{ color: C.text, fontWeight: '900' }}>Negotiation plan</Text><JsonBlock value={decision.negotiation_plan}/></Card></> : null}
      </> : null}

      {section === 'Clauses' ? <>{findings.map((f: any, index: number) => {
        const findingId = String(f.id || `finding-${index + 1}`); const pack = packs[findingId];
        return <Card key={findingId} style={{ gap: 9 }}><View style={styles.between}><Pill value={f.risk_level || f.risk || f.severity} /><Muted>{f.confidence || f.confidence_score || '—'}% confidence</Muted></View><Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>{f.issue || f.title}</Text><Muted>{f.clause_reference || f.clause_label || f.category || 'Document-wide'}</Muted>{f.quoted_text || f.evidence ? <Text selectable style={{ color: C.text, lineHeight: 20 }}>“{f.quoted_text || f.evidence}”</Text> : null}<TextInput value={instructions[findingId] || ''} onChangeText={value => setInstructions(current => ({ ...current, [findingId]: value }))} style={styles.field} placeholder="Optional: bank-favourable, mutual, preserve deal…" placeholderTextColor={C.muted}/><Action title={busy === `finding:${findingId}` ? 'Assessing…' : 'Assess + rewrite + strategy'} onPress={() => assessFinding(f, index)} disabled={Boolean(busy)} />{pack ? <View style={{ gap: 9, marginTop: 4 }}><View style={styles.between}><Pill value={pack.disposition}/><Muted>Priority {pack.priority}/5</Muted></View><Text style={{ color: C.text, fontWeight: '900' }}>{pack.headline}</Text><Muted>{pack.why}</Muted><Text style={{ color: C.teal, fontWeight: '900' }}>Worth raising?</Text><JsonBlock value={pack.worth_raising}/><Text style={{ color: C.teal, fontWeight: '900' }}>Quantification</Text><JsonBlock value={pack.quantification}/><Text style={{ color: C.teal, fontWeight: '900' }}>Preferred rewrite</Text><Text selectable style={{ color: C.text, lineHeight: 20 }}>{pack.rewrite?.preferred_text || 'No rewrite returned.'}</Text><Text style={{ color: C.teal, fontWeight: '900' }}>Fallback wording</Text><Text selectable style={{ color: C.text, lineHeight: 20 }}>{pack.rewrite?.fallback_text || 'No fallback returned.'}</Text><Text style={{ color: C.teal, fontWeight: '900' }}>Mitigation</Text><JsonBlock value={pack.mitigation_strategy}/><Text style={{ color: C.teal, fontWeight: '900' }}>Negotiation strategy</Text><JsonBlock value={pack.negotiation_strategy}/>{pack.currentLawCitations?.map((source: any, sourceIndex: number) => <Pressable key={`${source.url}-${sourceIndex}`} onPress={() => Linking.openURL(source.url)}><Text style={{ color: C.blue, lineHeight: 19 }}>{source.title || source.url}</Text></Pressable>)}<Action secondary title={busy === `memory:${findingId}` ? 'Saving…' : 'Save validated position to clause memory'} onPress={() => saveMemory(f, index)} disabled={Boolean(busy)} /></View> : null}</Card>;
      })}{!findings.length ? <Card><Muted>No clause findings are available. Re-run live analysis rather than relying on a generic response.</Muted></Card> : null}</> : null}

      {section === 'Exposure' ? <><View style={styles.between}><Text style={styles.sectionTitle}>Quantifiability</Text><Action title={exposure ? 'Refresh' : 'Refresh exposure'} secondary onPress={quantify} disabled={Boolean(busy)} /></View>{exposureItems.map((x: any, index: number) => <Card key={x.findingId || index} style={{ gap: 8 }}><View style={styles.between}><Pill value={x.riskLevel} /><Muted>{x.quantificationStatus}</Muted></View><Text style={{ color: C.text, fontWeight: '900' }}>{x.exposureLabel || 'Not reliably quantifiable'}</Text><Muted>{x.rationale}</Muted><JsonBlock value={x.directContractualExposure}/><Muted>Confidence {x.confidence ?? '—'}%. Scenario bands are risk-management assumptions, not legal maxima or expected loss.</Muted></Card>)}{!exposureItems.length ? <Card><Muted>No exposure model is recorded. High/Medium severity alone must never be converted into money.</Muted></Card> : null}</> : null}

      {section === 'Graph' ? <><Card style={{ gap: 8 }}><Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Document-derived graph</Text><Muted>{graphNodes.length} nodes · {graphEdges.length} relationships. These objects derive from this matter, not the old demo graph.</Muted></Card>{graphNodes.slice(0, 60).map((node: any) => <Card key={node.id} style={{ gap: 5 }}><View style={styles.between}><Pill value={node.type}/>{node.risk ? <Pill value={node.risk}/> : null}</View><Text style={{ color: C.text, fontWeight: '800' }}>{node.label}</Text>{node.text ? <Muted>{node.text}</Muted> : null}</Card>)}<Card style={{ gap: 7 }}><Text style={{ color: C.text, fontWeight: '900' }}>Clause-memory candidates</Text><Muted>{memories.length} candidates. They are not durable institutional memory until you approve a clause action pack.</Muted></Card></> : null}

      {section === 'Brain' ? <Card style={{ gap: 10 }}><Eyebrow>ASK ONLY THIS DOCUMENT</Eyebrow><TextInput multiline value={question} onChangeText={setQuestion} style={styles.textarea} placeholderTextColor={C.muted}/><Action title={busy === 'ask' ? 'Researching…' : 'Ask this matter'} onPress={ask} disabled={Boolean(busy) || !question.trim()}/>{answer?.answer ? <Text style={{ color: C.text, lineHeight: 21 }}>{answer.answer}</Text> : null}{answer?.live?.citations?.map((source: any, index: number) => <Pressable key={`${source.url}-${index}`} onPress={() => Linking.openURL(source.url)}><Text style={{ color: C.blue }}>{source.title || source.url}</Text></Pressable>)}</Card> : null}

      {section === 'Law' ? <Card style={{ gap: 9 }}><View style={styles.between}><Eyebrow>CURRENT-LAW VERIFICATION</Eyebrow><Pill value={currentLaw.liveWebUsed ? 'LIVE WEB USED' : currentLaw.status || 'NOT VERIFIED'}/></View><Text style={{ color: C.text, lineHeight: 21 }}>{currentLaw.answer || currentLaw.error || 'No live current-law answer is recorded.'}</Text>{(currentLaw.citations || []).map((source: any, index: number) => <Pressable key={`${source.url}-${index}`} onPress={() => Linking.openURL(source.url)}><Text style={{ color: C.blue, lineHeight: 19 }}>{source.title || source.url}</Text></Pressable>)}</Card> : null}
    </> : <Card><Muted>Document not found.</Muted></Card>}
  </ScrollView></Screen>;
}
