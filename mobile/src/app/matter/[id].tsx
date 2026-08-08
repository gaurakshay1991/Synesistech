import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SynesisAPI } from '@/lib/api';
import { Action, C, Card, Eyebrow, Muted, Pill, Screen, styles } from '@/ui';

export default function MatterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [exposure, setExposure] = useState<any>(null);
  const [question, setQuestion] = useState('What is the most material issue in this document and what should be changed before approval?');
  const [answer, setAnswer] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    SynesisAPI.document(id).then(data => setDoc(data.document)).catch((e: any) => setError(e.message)).finally(() => setBusy(false));
  }, [id]);

  async function quantify() {
    if (!id) return;
    setBusy(true); setError('');
    try { setExposure(await SynesisAPI.exposure(id)); }
    catch (e: any) { setError(e.message || 'Exposure analysis failed.'); }
    finally { setBusy(false); }
  }

  async function ask() {
    if (!id || !question.trim()) return;
    setBusy(true); setError('');
    try { setAnswer(await SynesisAPI.askDocument(id, question)); }
    catch (e: any) { setError(e.message || 'Document question failed.'); }
    finally { setBusy(false); }
  }

  if (busy && !doc) return <Screen><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.teal} /></View></Screen>;
  const a = doc?.analysis || {};
  const findings = a.findings || [];
  const obligations = a.obligations || [];
  const currentLaw = a.live_current_law;

  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}
    {doc ? <>
      <View style={{ gap: 7 }}><Eyebrow>ACTIVE MATTER</Eyebrow><Text style={styles.title}>{doc.title}</Text><Muted>{doc.matter || 'General review'} · {doc.jurisdiction || '—'} · {doc.documentType || 'Document'}</Muted></View>
      <Card style={{ gap: 10 }}><View style={styles.between}><Pill value={a.overall_risk || doc.overallRisk} /><Text style={styles.value}>{a.overall_score ?? doc.score ?? '—'}<Text style={{ fontSize: 12, color: C.muted }}>/100</Text></Text></View><Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{a.recommended_decision || 'Independent analysis completed'}</Text><Text style={{ color: C.text, lineHeight: 21 }}>{a.executive_position || a.document_summary || a.summary || 'No executive summary is available.'}</Text><Muted>Engine: {a.engine || doc.engine || 'SYNESIS'} · Current-law pass: {a.analysis_details?.current_law_web_used || currentLaw?.liveWebUsed ? 'used' : 'not recorded'} · Cross-document memory: excluded</Muted></Card>

      <View style={styles.between}><Text style={styles.sectionTitle}>Material findings</Text><Pill value={`${findings.length} issues`} /></View>
      {findings.slice(0, 20).map((f: any, index: number) => <Card key={f.id || index} style={{ gap: 8 }}><View style={styles.between}><Pill value={f.risk_level || f.risk || f.severity} /><Muted>{f.confidence || f.confidence_score || '—'}% confidence</Muted></View><Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{f.issue || f.title}</Text><Muted>{f.clause_reference || f.clause_label || f.category || 'Document-wide'}</Muted>{f.quoted_text || f.evidence ? <Text style={{ color: C.text, lineHeight: 20 }}>“{f.quoted_text || f.evidence}”</Text> : null}<Muted>{f.recommendation || f.mitigation || f.rewrite || 'Reviewer action required.'}</Muted></Card>)}
      {!findings.length ? <Card><Muted>No finding object is available for this matter.</Muted></Card> : null}

      <View style={styles.between}><Text style={styles.sectionTitle}>Exposure</Text><Action title={exposure ? 'Refresh' : 'Quantify'} secondary onPress={quantify} /></View>
      {exposure?.exposure?.exposures?.length ? exposure.exposure.exposures.map((x: any) => <Card key={x.findingId} style={{ gap: 8 }}><View style={styles.between}><Pill value={x.riskLevel} /><Muted>{x.quantificationStatus}</Muted></View><Text style={{ color: C.text, fontWeight: '800' }}>{x.exposureLabel}</Text><Muted>{x.rationale}</Muted><Muted>Confidence {x.confidence}%</Muted></Card>) : <Card><Muted>No exposure number is shown until the evidence model supports one. Uncapped liability stays unbounded; unsupported amounts stay unquantified.</Muted></Card>}
      {exposure?.authorityResearch?.answer ? <Card style={{ gap: 8 }}><Eyebrow>CURRENT AUTHORITY</Eyebrow><Text style={{ color: C.text, lineHeight: 21 }}>{exposure.authorityResearch.answer}</Text></Card> : null}

      {obligations.length ? <><Text style={styles.sectionTitle}>Compiled obligations</Text>{obligations.slice(0, 10).map((o: any, index: number) => <Card key={o.id || index} style={{ gap: 6 }}><Text style={{ color: C.text, fontWeight: '800' }}>{o.title || o.action || 'Obligation'}</Text><Muted>{o.owner || 'Owner not identified'} · {o.deadline || o.due || 'No explicit deadline'}</Muted></Card>)}</> : null}

      <Text style={styles.sectionTitle}>Ask this document</Text><Card style={{ gap: 10 }}><TextInput multiline value={question} onChangeText={setQuestion} style={styles.textarea} placeholderTextColor={C.muted} /><Action title={busy ? 'Analysing…' : 'Ask independently'} onPress={ask} disabled={busy || !question.trim()} />{answer?.answer ? <Text style={{ color: C.text, lineHeight: 21 }}>{answer.answer}</Text> : null}{answer?.citations?.length ? <Muted>{answer.citations.length} current sources returned.</Muted> : null}</Card>
    </> : <Card><Muted>Document not found.</Muted></Card>}
  </ScrollView></Screen>;
}
