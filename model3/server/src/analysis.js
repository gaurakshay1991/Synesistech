import crypto from 'node:crypto';
import path from 'node:path';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';

const textExtensions = new Set(['.txt', '.md', '.csv', '.json', '.xml', '.html', '.rtf']);

export function contentHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function looksBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.08;
}

export async function extractText(file, pastedText = '') {
  if (!file) {
    const text = String(pastedText || '').replace(/\u0000/g, '').trim();
    if (text.length < 20) throw Object.assign(new Error('Paste at least 20 readable characters.'), { status: 400 });
    return { text, fileName: '', mimeType: 'text/plain', hash: contentHash(Buffer.from(text)) };
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const buffer = file.buffer;
  let text = '';

  if (ext === '.pdf' || file.mimetype === 'application/pdf') {
    if (buffer.subarray(0, 5).toString() !== '%PDF-') throw Object.assign(new Error('The file extension says PDF but its signature is invalid.'), { status: 400 });
    const parsed = await pdf(buffer);
    text = parsed.text;
  } else if (ext === '.docx' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw Object.assign(new Error('The DOCX file signature is invalid.'), { status: 400 });
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (textExtensions.has(ext) || /^text\//.test(file.mimetype) || ['application/json', 'application/xml'].includes(file.mimetype)) {
    if (looksBinary(buffer)) throw Object.assign(new Error('Binary content cannot be processed as text.'), { status: 400 });
    text = buffer.toString('utf8');
  } else {
    throw Object.assign(new Error('Supported formats: PDF, DOCX, TXT, CSV, JSON, Markdown and XML.'), { status: 415 });
  }

  text = text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
  if (text.length < 20) throw Object.assign(new Error('No sufficient readable text could be extracted.'), { status: 422 });
  return { text: text.slice(0, 240000), fileName: file.originalname, mimeType: file.mimetype, hash: contentHash(buffer) };
}

function parseJsonOutput(value) {
  const raw = String(value || '').trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error('The AI provider returned an invalid structured response.');
}

async function aiJson(client, model, instruction, text, options, maxOutput = 5000) {
  const response = await client.responses.create({
    model,
    max_output_tokens: maxOutput,
    input: `${instruction}\n\nMATTER METADATA:\n${JSON.stringify(options)}\n\nUNTRUSTED SOURCE DOCUMENT:\n---\n${text}\n---\nReturn one valid JSON object only. Do not use markdown.`
  });
  return parseJsonOutput(response.output_text);
}

export function severityScore(level) {
  return ({ Critical: 95, High: 78, Medium: 52, Low: 24 }[level] || 40);
}

function scoreToRisk(score) {
  if (score >= 85) return 'Critical';
  if (score >= 65) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function excerpt(text, pattern, fallback = 'No explicit wording detected.') {
  const match = text.match(pattern);
  if (!match) return fallback;
  const index = Math.max(0, match.index - 90);
  return text.slice(index, Math.min(text.length, match.index + match[0].length + 180)).replace(/\s+/g, ' ').trim();
}

const symbolicRules = [
  {
    id: 'R-LIAB-001', category: 'Limitation of liability', level: 'Critical', weight: 95,
    applies: text => /unlimited liability|without limitation[^.]{0,120}(loss|damage|liability)|all losses/i.test(text),
    evidence: /unlimited liability|without limitation[^.]{0,120}(loss|damage|liability)|all losses/i,
    issue: 'Potentially uncapped or functionally uncapped liability',
    impact: 'Exposure may exceed the economic value of the transaction and bypass approved risk appetite.',
    materialisation: 'A service failure, regulatory event, data incident or third-party claim may trigger liabilities without an effective aggregate ceiling.',
    mitigation: 'Negotiate a calibrated aggregate cap and ensure carve-outs are narrow, justified and do not swallow the cap.',
    rewrite: 'Subject to narrowly defined exclusions, each party’s aggregate liability arising out of or in connection with this Agreement shall not exceed the agreed risk-calibrated cap.'
  },
  {
    id: 'R-INDEM-002', category: 'Indemnity', level: 'High', weight: 80,
    applies: text => /indemnif/i.test(text) && !/third[- ]party claim|defen[cs]e of (a )?claim|control of (the )?defen[cs]e|mitigat/i.test(text),
    evidence: /[^.]{0,100}indemnif[^.]{0,220}/i,
    issue: 'Indemnity lacks claim-control and loss-allocation safeguards',
    impact: 'The indemnity may operate as an uncontrolled first-party recovery route outside ordinary damages principles.',
    materialisation: 'The beneficiary may settle, incur or assert losses without adequate causation, defence control, mitigation or no-double-recovery protections.',
    mitigation: 'Limit the indemnity to defined claims, require causation, notice, defence control, mitigation and prohibit double recovery.',
    rewrite: 'The indemnity applies only to losses directly arising from the specified breach, subject to prompt notice, indemnifier control of defence, reasonable cooperation, mitigation and no double recovery.'
  },
  {
    id: 'R-DATA-003', category: 'Data protection', level: 'High', weight: 82,
    applies: text => /personal data|personal information|confidential information|customer data/i.test(text) && !/(within|no later than).{0,60}(hour|hours|day|days)|immediately notify|without undue delay/i.test(text),
    evidence: /personal data|personal information|confidential information|customer data/i,
    issue: 'Security incident notification timing is not operationally definite',
    impact: 'Delayed notice can impair containment, regulatory assessment, customer response and evidence preservation.',
    materialisation: 'The institution may learn of a breach after contractual, regulatory or customer-response deadlines have become difficult to meet.',
    mitigation: 'Require immediate notice, a fixed outer deadline, continuous updates, forensic cooperation and preservation of evidence.',
    rewrite: 'The Service Provider shall notify the Institution immediately upon becoming aware of an incident and in any event within the agreed maximum period, followed by continuous material updates and full cooperation.'
  },
  {
    id: 'R-AUDIT-004', category: 'Audit and assurance', level: 'High', weight: 74,
    applies: text => /service provider|vendor|supplier|processor|outsourc/i.test(text) && !/audit|inspect|regulator access|access to records|books and records/i.test(text),
    evidence: /service provider|vendor|supplier|processor|outsourc/i,
    issue: 'Audit, inspection or regulator-access rights appear absent',
    impact: 'The institution may be unable to test controls, verify compliance or satisfy supervisory requests.',
    materialisation: 'A control failure may remain unverified because records, personnel, systems or subcontractors cannot be inspected.',
    mitigation: 'Add institution, auditor and regulator access rights, record retention, remediation and independent-assurance obligations.',
    rewrite: 'The Institution, its auditors and competent regulators may inspect relevant records, systems, controls, personnel and subcontractors on reasonable notice and immediately following a material incident.'
  },
  {
    id: 'R-EXIT-005', category: 'Operational resilience', level: 'High', weight: 78,
    applies: text => /service provider|vendor|supplier|outsourc/i.test(text) && !/business continuity|disaster recovery|exit plan|transition assistance|data portability/i.test(text),
    evidence: /service provider|vendor|supplier|outsourc/i,
    issue: 'Business continuity and exit protections appear incomplete',
    impact: 'Termination or disruption may become an unmanaged operational, customer or regulatory event.',
    materialisation: 'The institution may be unable to substitute the provider, recover data, maintain service or evidence deletion.',
    mitigation: 'Require tested BCP/DR, recovery objectives, an exit plan, transition assistance, portability and deletion evidence.',
    rewrite: 'The Service Provider shall maintain and test business continuity and disaster recovery arrangements and provide orderly transition assistance, data portability and verified deletion on exit.'
  },
  {
    id: 'R-SANC-006', category: 'Financial crime and sanctions', level: 'High', weight: 80,
    applies: text => /sanction|anti-money laundering|terroris|financial crime/i.test(text) && !/suspend|terminate|refuse|withhold performance/i.test(text),
    evidence: /sanction|anti-money laundering|terroris|financial crime/i,
    issue: 'Financial-crime event lacks an express suspension or exit mechanism',
    impact: 'The institution may remain contractually exposed while legal, sanctions or reputational risk is escalating.',
    materialisation: 'A counterparty event may require immediate action but the agreement provides only ordinary termination mechanics.',
    mitigation: 'Add immediate suspension, information, audit, refusal and termination rights for specified financial-crime events.',
    rewrite: 'The Institution may immediately suspend or terminate performance where it reasonably considers this necessary to comply with sanctions, AML, counter-terrorist financing or related legal obligations.'
  },
  {
    id: 'R-DISPUTE-007', category: 'Dispute resolution', level: 'Medium', weight: 54,
    applies: text => /agreement|contract|terms/i.test(text) && !/governing law|jurisdiction|arbitration|dispute resolution/i.test(text),
    evidence: /agreement|contract|terms/i,
    issue: 'Governing law and dispute-resolution mechanics are not evident',
    impact: 'Enforcement, forum, interim relief and procedural cost may become uncertain.',
    materialisation: 'A dispute may generate parallel proceedings, forum challenges or delay in obtaining urgent relief.',
    mitigation: 'Specify governing law, forum or arbitration seat, service mechanics and interim-relief rights.',
    rewrite: 'This Agreement is governed by the agreed law and disputes shall be resolved through the agreed exclusive court or arbitration mechanism, without prejudice to urgent interim relief.'
  },
  {
    id: 'R-AI-008', category: 'AI governance', level: 'High', weight: 76,
    applies: text => /artificial intelligence|machine learning|large language model|generative ai|automated decision|model output/i.test(text) && !/human oversight|model register|training data|no training|auditab|explainab|approved model/i.test(text),
    evidence: /artificial intelligence|machine learning|large language model|generative ai|automated decision|model output/i,
    issue: 'AI use is not accompanied by governance, data-use and human-oversight controls',
    impact: 'Confidentiality, model risk, inaccurate outputs, unlawful processing and unreviewed automated decisions may arise.',
    materialisation: 'The provider may use unapproved models, train on institutional data or produce consequential outputs without accountable review.',
    mitigation: 'Require declared approved use cases, no training on institutional data, model/version records, evaluation, human oversight, incident reporting and audit rights.',
    rewrite: 'No AI system may process Institutional Data or make a consequential decision unless expressly approved, recorded, evaluated, subject to human oversight and prohibited from training on such data.'
  },
  {
    id: 'R-ESG-009', category: 'ESG and supply chain', level: 'Medium', weight: 50,
    applies: text => /supplier|supply chain|manufactur|procurement/i.test(text) && /environment|sustainab|labour|human rights|modern slavery|emission/i.test(text) && !/audit|remediation|corrective action|termination/i.test(text),
    evidence: /environment|sustainab|labour|human rights|modern slavery|emission/i,
    issue: 'ESG commitment lacks audit, remediation or enforcement mechanics',
    impact: 'The obligation may be aspirational and difficult to verify or enforce.',
    materialisation: 'Supplier misconduct may continue without evidence rights, corrective action deadlines or termination consequences.',
    mitigation: 'Add measurable standards, evidence, audit rights, remediation plans, escalation and termination for material failure.',
    rewrite: 'The Supplier shall meet the specified ESG standards, provide supporting evidence, permit audits, implement time-bound corrective action and accept termination for material or repeated failure.'
  },
  {
    id: 'R-SUB-010', category: 'Subcontracting', level: 'High', weight: 72,
    applies: text => /subcontract|sub-?processor|delegate/i.test(text) && !/prior written consent|remain responsible|flow[- ]down|back-to-back/i.test(text),
    evidence: /[^.]{0,100}(subcontract|sub-?processor|delegate)[^.]{0,220}/i,
    issue: 'Subcontracting rights lack consent, accountability or flow-down controls',
    impact: 'Critical obligations may be delegated to an unassessed party without equivalent contractual protection.',
    materialisation: 'A subcontractor may mishandle data, disrupt service or breach law while the primary provider disputes responsibility.',
    mitigation: 'Require prior approval for material subcontractors, full primary liability, due diligence, flow-down obligations and exit rights.',
    rewrite: 'The Service Provider shall not appoint a material subcontractor without prior written approval and remains fully responsible for all subcontracted acts and omissions under equivalent obligations.'
  }
];

const positiveRules = [
  { id: 'P-CAP-001', label: 'Express aggregate liability cap detected', weight: -10, applies: text => /aggregate liability.{0,120}(shall not exceed|limited to|cap)/i.test(text) },
  { id: 'P-AUDIT-002', label: 'Audit or regulator-access language detected', weight: -8, applies: text => /regulator access|audit rights|right to inspect|access to records/i.test(text) },
  { id: 'P-INC-003', label: 'Definite incident notification language detected', weight: -8, applies: text => /(within|no later than).{0,50}(hour|hours|day|days)|immediately notify|without undue delay/i.test(text) },
  { id: 'P-EXIT-004', label: 'Transition or exit-assistance language detected', weight: -8, applies: text => /exit plan|transition assistance|data portability|orderly transition/i.test(text) },
  { id: 'P-AI-005', label: 'Human oversight or AI-use restriction detected', weight: -6, applies: text => /human oversight|no training on|approved model|model register/i.test(text) }
];

export function symbolicClauseAssessment(text, options = {}) {
  const source = String(text || '');
  const fired = symbolicRules.filter(rule => rule.applies(source)).map(rule => ({
    id: rule.id,
    category: rule.category,
    risk_level: rule.level,
    weight: rule.weight,
    issue: rule.issue,
    evidence: excerpt(source, rule.evidence),
    institutional_impact: rule.impact,
    how_risk_may_materialise: rule.materialisation,
    recommended_mitigation: rule.mitigation,
    suggested_rewrite: rule.rewrite
  }));
  const controls = positiveRules.filter(rule => rule.applies(source)).map(rule => ({ id: rule.id, label: rule.label, weight: rule.weight }));
  const base = fired.length ? fired.reduce((sum, item) => sum + item.weight, 0) / fired.length : 34;
  const controlAdjustment = controls.reduce((sum, item) => sum + item.weight, 0);
  const densityAdjustment = Math.min(8, Math.max(0, fired.length - 3) * 1.5);
  const score = Math.max(5, Math.min(100, Math.round(base + controlAdjustment + densityAdjustment)));
  return {
    engine: 'Synesis deterministic legal-rule engine v4',
    score,
    overall_risk: scoreToRisk(score),
    rules_fired: fired,
    positive_controls: controls,
    missing_protections: fired.map(item => item.category),
    clause_fingerprint: contentHash(Buffer.from(source.toLowerCase().replace(/\s+/g, ' ').slice(0, 120000))),
    metadata: {
      jurisdiction: options.jurisdiction || 'Not specified',
      documentType: options.documentType || 'Not specified',
      rulesEvaluated: symbolicRules.length + positiveRules.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function normaliseFinding(item, index) {
  const level = ['Critical', 'High', 'Medium', 'Low'].includes(item?.risk_level) ? item.risk_level : 'Medium';
  return {
    id: item?.id || `finding-${index + 1}`,
    rule_id: item?.rule_id || item?.id || null,
    category: String(item?.category || 'General'),
    risk_level: level,
    confidence: Math.max(1, Math.min(100, Number(item?.confidence || 70))),
    issue: String(item?.issue || 'Review point'),
    clause_reference: String(item?.clause_reference || 'Document-wide'),
    quoted_text: String(item?.quoted_text || item?.evidence || ''),
    institutional_impact: String(item?.institutional_impact || item?.why_risky_for_bank || ''),
    how_risk_may_materialise: String(item?.how_risk_may_materialise || ''),
    recommended_mitigation: String(item?.recommended_mitigation || ''),
    suggested_rewrite: String(item?.suggested_rewrite || ''),
    review_owner: Array.isArray(item?.review_owner) ? item.review_owner : ['Legal'],
    affected_stakeholders: Array.isArray(item?.affected_stakeholders) ? item.affected_stakeholders : [],
    materiality: String(item?.materiality || level),
    reasoning_source: String(item?.reasoning_source || (item?.rule_id ? 'Symbolic rule' : 'Neural analysis'))
  };
}

function symbolicFindings(symbolic) {
  return symbolic.rules_fired.map((item, index) => normaliseFinding({
    id: `symbolic-${item.id}`,
    rule_id: item.id,
    category: item.category,
    risk_level: item.risk_level,
    confidence: 92,
    issue: item.issue,
    clause_reference: `Rule ${item.id}`,
    quoted_text: item.evidence,
    institutional_impact: item.institutional_impact,
    how_risk_may_materialise: item.how_risk_may_materialise,
    recommended_mitigation: item.recommended_mitigation,
    suggested_rewrite: item.suggested_rewrite,
    review_owner: ['Legal', 'Compliance', 'Risk'],
    affected_stakeholders: [],
    materiality: item.risk_level,
    reasoning_source: 'Symbolic rule'
  }, index));
}

function dedupe(items, key) {
  const seen = new Set();
  return items.filter(item => {
    const value = String(item?.[key] || JSON.stringify(item)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function deriveLitigationRisk(symbolic, findings, options) {
  const disputeSignals = findings.filter(item => ['Limitation of liability', 'Indemnity', 'Dispute resolution', 'Data protection'].includes(item.category));
  const probability = Math.max(5, Math.min(85, Math.round(12 + disputeSignals.length * 9 + symbolic.score * 0.18)));
  const enforceability = Math.max(20, Math.min(90, Math.round(76 - disputeSignals.length * 6 + (symbolic.positive_controls.length * 4))));
  const confidence = Math.max(25, Math.min(70, Math.round(35 + Math.min(20, findings.length * 2))));
  return {
    status: 'Scenario indicator only — not a court-outcome prediction',
    jurisdiction: options.jurisdiction || 'Not specified',
    dispute_probability_indicator: probability,
    enforceability_indicator: enforceability,
    confidence,
    drivers: disputeSignals.slice(0, 6).map(item => item.issue),
    limitation: 'No case-law dataset or verified litigation facts were used. Authorised counsel must assess actual enforceability and remedies.'
  };
}

function fallbackAnalysis(text, options, failure = '') {
  const symbolic = symbolicClauseAssessment(text, options);
  let findings = symbolicFindings(symbolic);
  if (!findings.length) {
    findings = [normaliseFinding({
      id: 'symbolic-general-review',
      category: 'General',
      risk_level: 'Medium',
      confidence: 58,
      issue: 'Authorised legal and control review remains required',
      clause_reference: 'Document-wide',
      quoted_text: excerpt(text, /agreement|shall|party/i),
      institutional_impact: 'The deterministic engine cannot certify the document as low risk solely because no configured pattern fired.',
      how_risk_may_materialise: 'Unconfigured or context-dependent exposures may remain outside the rule catalogue.',
      recommended_mitigation: 'Complete live multipass analysis and authorised review before approval.',
      suggested_rewrite: 'Document-specific drafting must follow authorised legal review.',
      review_owner: ['Legal', 'Compliance'],
      reasoning_source: 'Symbolic rule'
    }, 0)];
  }

  const obligations = [
    { id: 'ob-1', title: 'Implement identified contractual and control mitigations', type: 'Remediation', owner: 'Legal / Compliance', trigger: 'Before approval or execution', deadline: 'Before approval', status: 'Proposed', risk: findings[0].risk_level, source_reference: findings[0].clause_reference, evidence_required: ['Approved wording', 'Control owner acceptance'] },
    { id: 'ob-2', title: 'Retain approval and completion evidence', type: 'Governance', owner: 'Matter owner', trigger: 'On final decision', deadline: 'At closure', status: 'Proposed', risk: 'Medium', source_reference: 'Decision governance', evidence_required: ['Approval record', 'Final signed document', 'Closure confirmation'] }
  ];

  return {
    engine: 'Synesis neuro-symbolic fallback — deterministic legal rules only',
    overall_risk: symbolic.overall_risk,
    overall_score: symbolic.score,
    recommended_decision: 'Do not treat deterministic fallback as final. Complete live multipass analysis and authorised legal review.',
    executive_position: `The symbolic engine evaluated ${symbolic.metadata.rulesEvaluated} configured rules and identified ${symbolic.rules_fired.length} material rule signals.`,
    document_summary: `${options.documentType || 'Document'} concerning ${options.matter || 'the stated matter'} in ${options.jurisdiction || 'the selected jurisdiction'}.`,
    findings,
    obligations,
    permissions: [],
    prohibitions: [],
    actors: [],
    triggers: [],
    dependencies: [],
    approval_gates: [{ gate: 'Authorised legal and compliance review', required_roles: ['Legal', 'Compliance'], risk: 'High' }],
    decision_questions: [{ question: 'Can the institution proceed within risk appetite after the identified protections are addressed?', owner: 'Matter owner', urgency: 'High' }],
    required_actions: obligations.map((item, index) => ({ id: `action-${index + 1}`, title: item.title, owner: item.owner, due: item.deadline, evidence_required: item.evidence_required })),
    completion_evidence: ['Approved final wording', 'Recorded decision', 'Control-owner acceptance'],
    missing_clauses: symbolic.missing_protections,
    contradictions: [],
    regulatory_touchpoints: [],
    scenarios: [],
    affected_entities: [],
    affected_controls: [],
    affected_products: [],
    affected_processes: [],
    affected_systems: [],
    affected_teams: [],
    neuro_symbolic: {
      architecture: 'Deterministic symbolic pass; neural passes unavailable',
      neural_signal_score: null,
      symbolic_signal_score: symbolic.score,
      reconciliation: 'Symbolic score used because live neural analysis was unavailable.',
      symbolic
    },
    reasoning_trace: symbolic.rules_fired.map(item => ({ step: item.id, type: 'Symbolic rule', proposition: item.issue, evidence: item.evidence, result: item.risk_level })),
    clause_memory_candidates: symbolic.rules_fired.map(item => ({ category: item.category, fingerprint: symbolic.clause_fingerprint, proposedLesson: item.recommended_mitigation, status: 'Candidate — human validation required' })),
    litigation_risk: deriveLitigationRisk(symbolic, findings, options),
    rewrite_candidates: findings.filter(item => item.suggested_rewrite).map(item => ({ issue: item.issue, proposedText: item.suggested_rewrite, status: 'Draft — authorised review required' })),
    challenge: { conclusion: 'Live senior challenge not completed.', false_positive_risk: 'High', omissions: ['Current-law verification', 'Independent neural interpretation', 'Case-law validation'], approval_conditions: ['Authorised legal review'], confidence: 40 },
    source_verification: { status: 'Not performed', sources: [], limitation: 'No authorised current-law connector or source pack was used.' },
    assumptions_and_limits: ['Results are decision support, not legal advice or regulatory certification.', failure || 'Live AI was not configured.', 'Configured symbolic rules cannot identify every context-dependent legal issue.'],
    analysis_details: { live_ai_used: false, independent_passes: 1, model: 'Deterministic rules', failure, characters_reviewed: text.length, generated_at: new Date().toISOString(), clause_fingerprint: symbolic.clause_fingerprint }
  };
}

export async function analyzeDocument({ client, model, text, options }) {
  const symbolic = symbolicClauseAssessment(text, options);
  if (!client) return fallbackAnalysis(text, options, 'OPENAI_API_KEY is not configured.');

  try {
    const primary = await aiJson(client, model, `You are the neural interpretation pass inside a neuro-symbolic legal intelligence system for a regulated institution. Analyse only the supplied document. The deterministic rule engine has produced this non-authoritative signal pack: ${JSON.stringify({ score: symbolic.score, risk: symbolic.overall_risk, rules: symbolic.rules_fired.map(item => ({ id: item.id, issue: item.issue, evidence: item.evidence })) })}. Independently identify clause-level and document-wide issues, evidence, materiality, institutional impact, affected stakeholders, mitigations and exact document-specific protective wording. Do not merely repeat the rules and do not assert current law unless separately verified. Required JSON keys: document_summary, executive_position, findings[], missing_clauses[], contradictions[], actors[], regulatory_touchpoints[], scenarios[], clause_memory_candidates[], assumptions_and_limits[]. Each finding must have category, risk_level, confidence, issue, clause_reference, quoted_text, institutional_impact, how_risk_may_materialise, recommended_mitigation, suggested_rewrite, review_owner[], affected_stakeholders[], materiality.`, text, options, 7000);

    const decision = await aiJson(client, model, `You are an independent decision and execution modeller. Convert the supplied evidence into a controlled institutional operating model. Return JSON keys: obligations[], permissions[], prohibitions[], triggers[], dependencies[], approval_gates[], decision_questions[], required_actions[], completion_evidence[], affected_entities[], affected_controls[], affected_products[], affected_processes[], affected_systems[], affected_teams[]. Each obligation must contain title, type, owner, trigger, deadline, status, risk, source_reference, evidence_required[]. Each required action must have title, owner, due, dependencies[], approval_gate, evidence_required[]. Never authorise autonomous high-risk execution.`, text, options, 5500);

    const challenge = await aiJson(client, model, `You are the independent senior challenge pass. Re-read the source from first principles and challenge both the neural findings and this symbolic signal pack: ${JSON.stringify({ score: symbolic.score, rules: symbolic.rules_fired.map(item => item.id) })}. Test cross-clause interaction, false positives, rule overreach, omissions, underweighted exposure, commercial proportionality and whether the proposed decision can be defended to management, audit and a regulator. Return JSON keys: conclusion, confirmed_findings[], additional_findings[], downgraded_findings[], omissions[], dissent, recommended_decision, approval_conditions[], confidence.`, text, options, 4500);

    const neuralFindings = [...(primary.findings || []), ...(challenge.additional_findings || [])].map((item, index) => normaliseFinding({ ...item, reasoning_source: 'Neural analysis' }, index));
    const findings = dedupe([...symbolicFindings(symbolic), ...neuralFindings], 'issue');
    const neuralAverage = neuralFindings.length ? neuralFindings.reduce((sum, item) => sum + severityScore(item.risk_level), 0) / neuralFindings.length : 35;
    const challengeAdjustment = Math.min(8, (challenge.omissions || []).length * 1.5);
    const score = Math.max(1, Math.min(100, Math.round(symbolic.score * 0.4 + neuralAverage * 0.6 + challengeAdjustment)));
    const overall = scoreToRisk(score);
    const reconciliation = symbolic.overall_risk === overall
      ? 'Neural and symbolic layers converged on the same overall risk band.'
      : `The reconciled score differs from the symbolic ${symbolic.overall_risk} signal because the neural and challenge passes assessed context and cross-clause interaction.`;

    return {
      engine: `Synesis neuro-symbolic multipass (${model})`,
      overall_risk: overall,
      overall_score: score,
      recommended_decision: String(challenge.recommended_decision || primary.recommended_decision || 'Proceed only after authorised review of the stated conditions.'),
      executive_position: String(primary.executive_position || challenge.conclusion || ''),
      document_summary: String(primary.document_summary || ''),
      findings,
      obligations: decision.obligations || [],
      permissions: decision.permissions || [],
      prohibitions: decision.prohibitions || [],
      actors: primary.actors || [],
      triggers: decision.triggers || [],
      dependencies: decision.dependencies || [],
      approval_gates: decision.approval_gates || [],
      decision_questions: decision.decision_questions || [],
      required_actions: decision.required_actions || [],
      completion_evidence: decision.completion_evidence || [],
      missing_clauses: dedupe([...(primary.missing_clauses || []), ...symbolic.missing_protections].map(value => typeof value === 'string' ? { value } : value), 'value').map(item => item.value || item),
      contradictions: primary.contradictions || [],
      regulatory_touchpoints: primary.regulatory_touchpoints || [],
      scenarios: primary.scenarios || [],
      affected_entities: decision.affected_entities || [],
      affected_controls: decision.affected_controls || [],
      affected_products: decision.affected_products || [],
      affected_processes: decision.affected_processes || [],
      affected_systems: decision.affected_systems || [],
      affected_teams: decision.affected_teams || [],
      neuro_symbolic: {
        architecture: 'Deterministic symbolic rule pass + neural interpretation + execution model + independent senior challenge',
        neural_signal_score: Math.round(neuralAverage),
        symbolic_signal_score: symbolic.score,
        reconciled_score: score,
        reconciliation,
        symbolic
      },
      reasoning_trace: [
        ...symbolic.rules_fired.map(item => ({ step: item.id, type: 'Symbolic rule', proposition: item.issue, evidence: item.evidence, result: item.risk_level })),
        { step: 'N-INTERPRET', type: 'Neural interpretation', proposition: `${neuralFindings.length} context-sensitive findings generated`, evidence: 'Document-grounded neural pass', result: Math.round(neuralAverage) },
        { step: 'D-MODEL', type: 'Decision model', proposition: `${(decision.obligations || []).length} obligations and ${(decision.required_actions || []).length} actions compiled`, evidence: 'Document-grounded execution pass', result: 'Human-gated' },
        { step: 'C-CHALLENGE', type: 'Independent challenge', proposition: challenge.conclusion || 'Challenge completed', evidence: `${(challenge.omissions || []).length} possible omissions recorded`, result: challenge.confidence || 'Unstated' },
        { step: 'R-RECONCILE', type: 'Risk reconciliation', proposition: reconciliation, evidence: `40% symbolic / 60% neural plus challenge adjustment`, result: score }
      ],
      clause_memory_candidates: (primary.clause_memory_candidates || symbolic.rules_fired.map(item => ({ category: item.category, proposedLesson: item.recommended_mitigation }))).map(item => ({ ...item, fingerprint: symbolic.clause_fingerprint, status: 'Candidate — human validation required' })),
      litigation_risk: deriveLitigationRisk(symbolic, findings, options),
      rewrite_candidates: findings.filter(item => item.suggested_rewrite).map(item => ({ issue: item.issue, category: item.category, proposedText: item.suggested_rewrite, status: 'Draft — authorised review required' })),
      challenge,
      source_verification: { status: 'Document-grounded only', sources: [], limitation: 'Current-law propositions require an authorised source pack or licensed connector.' },
      assumptions_and_limits: primary.assumptions_and_limits || [],
      analysis_details: { live_ai_used: true, independent_passes: 4, model, characters_reviewed: text.length, generated_at: new Date().toISOString(), clause_fingerprint: symbolic.clause_fingerprint }
    };
  } catch (error) {
    return fallbackAnalysis(text, options, String(error.message || error).slice(0, 500));
  }
}

export async function answerDocumentQuestion({ client, model, document, question }) {
  const analysis = document.analysis || {};
  if (!client) {
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
    const ranked = (analysis.findings || []).map(item => ({ item, score: terms.reduce((sum, term) => sum + Number(JSON.stringify(item).toLowerCase().includes(term)), 0) })).sort((a, b) => b.score - a.score).slice(0, 5);
    return ranked.filter(item => item.score > 0).map(({ item }) => `${item.issue}: ${item.institutional_impact}\nEvidence: ${item.quoted_text}\nAction: ${item.recommended_mitigation}\nReasoning: ${item.reasoning_source || 'Recorded analysis'}`).join('\n\n') || 'The active analysis does not contain enough evidence to answer reliably.';
  }
  const response = await client.responses.create({
    model,
    max_output_tokens: 1400,
    input: `Answer the question using only the active document and its recorded neuro-symbolic analysis. Cite clause references, rule identifiers and quoted evidence where available. Distinguish evidence, rule-based inference and neural interpretation. State uncertainty. Do not use facts from other matters.\n\nQUESTION: ${question}\n\nDOCUMENT: ${document.sourceText}\n\nANALYSIS: ${JSON.stringify(analysis)}`
  });
  return response.output_text;
}
