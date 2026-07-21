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

function severityScore(level) {
  return ({ Critical: 95, High: 78, Medium: 52, Low: 24 }[level] || 40);
}

function normaliseFinding(item, index) {
  const level = ['Critical', 'High', 'Medium', 'Low'].includes(item?.risk_level) ? item.risk_level : 'Medium';
  return {
    id: item?.id || `finding-${index + 1}`,
    risk_level: level,
    confidence: Math.max(1, Math.min(100, Number(item?.confidence || 70))),
    issue: String(item?.issue || 'Review point'),
    clause_reference: String(item?.clause_reference || 'Document-wide'),
    quoted_text: String(item?.quoted_text || ''),
    institutional_impact: String(item?.institutional_impact || item?.why_risky_for_bank || ''),
    how_risk_may_materialise: String(item?.how_risk_may_materialise || ''),
    recommended_mitigation: String(item?.recommended_mitigation || ''),
    suggested_rewrite: String(item?.suggested_rewrite || ''),
    review_owner: Array.isArray(item?.review_owner) ? item.review_owner : ['Legal'],
    affected_stakeholders: Array.isArray(item?.affected_stakeholders) ? item.affected_stakeholders : [],
    materiality: String(item?.materiality || level)
  };
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

function fallbackAnalysis(text, options, failure = '') {
  const lower = text.toLowerCase();
  const findings = [];
  const add = (level, issue, pattern, impact, mitigation) => {
    const match = text.match(pattern);
    findings.push(normaliseFinding({
      risk_level: level,
      confidence: match ? 82 : 58,
      issue,
      clause_reference: 'Keyword / clause-pattern review',
      quoted_text: match?.[0] || 'No explicit protective wording detected in the extracted text.',
      institutional_impact: impact,
      how_risk_may_materialise: 'The exposure may arise when the relevant event occurs and the institution lacks a clear contractual, control or approval response.',
      recommended_mitigation: mitigation,
      suggested_rewrite: 'Insert document-specific protective language after authorised legal review.',
      review_owner: ['Legal', 'Compliance', 'Risk']
    }, findings.length));
  };

  if (/unlimited liability|without limitation|all losses/i.test(text)) add('Critical', 'Potentially uncapped liability', /unlimited liability|without limitation|all losses/i, 'Loss can exceed the economic value of the arrangement and bypass risk appetite.', 'Negotiate a calibrated cap with carve-outs limited to deliberate misconduct, confidentiality, data, IP and regulatory loss where justified.');
  if (/indemnif/i.test(text)) add('High', 'Broad indemnity exposure', /[^.]{0,80}indemnif[^.]{0,160}/i, 'The indemnity may operate independently of ordinary damages limitations.', 'Limit scope, causation, defence control, mitigation and double recovery.');
  if (/sanction|aml|anti-money|terror/i.test(text) && !/terminate|suspend/i.test(lower)) add('High', 'Sanctions or AML event lacks an express response right', /sanction|aml|anti-money|terror/i, 'The institution may remain bound while legal or reputational exposure is escalating.', 'Add immediate suspension, information, audit and termination rights for a sanctions or financial-crime event.');
  if (/data|personal information|confidential/i.test(text) && !/breach.{0,80}(hour|day)|incident.{0,80}(hour|day)/i.test(lower)) add('High', 'Incident notification timing is unclear', /data|personal information|confidential/i, 'Delayed notification impairs containment, regulatory reporting and customer response.', 'Require immediate notice and a fixed maximum notification period with continuous updates.');
  if (!/audit|inspect|records/i.test(lower)) add('Medium', 'Audit and evidence rights may be missing', /agreement|service|party/i, 'The institution may be unable to prove compliance or test the counterparty control environment.', 'Add record retention, inspection, independent assurance and regulator-access rights.');
  if (!/business continuity|disaster recovery|exit plan|transition assistance/i.test(lower)) add('High', 'Operational resilience and exit protections appear incomplete', /service|provider|vendor/i, 'A disruption or termination may become an unmanaged operational event.', 'Add BCP/DR tests, recovery objectives, exit plan, transition assistance, data portability and deletion evidence.');
  if (!findings.length) add('Medium', 'Senior legal and control review required', /agreement|shall|party/i, 'The fallback engine cannot reliably certify the document as low risk.', 'Complete live multipass analysis before approval.');

  const obligations = [
    { id: 'ob-1', title: 'Implement identified contractual and control mitigations', type: 'Remediation', owner: 'Legal / Compliance', trigger: 'Before approval or execution', deadline: 'Before approval', status: 'Proposed', risk: findings[0].risk_level, source_reference: findings[0].clause_reference, evidence_required: ['Approved wording', 'Control owner acceptance'] },
    { id: 'ob-2', title: 'Retain approval and completion evidence', type: 'Governance', owner: 'Matter owner', trigger: 'On final decision', deadline: 'At closure', status: 'Proposed', risk: 'Medium', source_reference: 'Decision governance', evidence_required: ['Approval record', 'Final signed document', 'Closure confirmation'] }
  ];

  const score = Math.round(findings.reduce((sum, item) => sum + severityScore(item.risk_level), 0) / findings.length);
  return {
    engine: 'Emergency deterministic fallback — not completed Synesis analysis',
    overall_risk: score >= 85 ? 'Critical' : score >= 65 ? 'High' : score >= 40 ? 'Medium' : 'Low',
    overall_score: score,
    recommended_decision: 'Do not treat this fallback as final. Complete live multipass analysis and authorised review.',
    executive_position: `A document-specific emergency scan identified ${findings.length} review points. Live reasoning was unavailable.`,
    document_summary: `${options.documentType || 'Document'} concerning ${options.matter || 'the stated matter'} in ${options.jurisdiction || 'the selected jurisdiction'}.`,
    findings,
    obligations,
    actors: [],
    triggers: [],
    dependencies: [],
    approval_gates: [{ gate: 'Authorised legal/compliance review', required_roles: ['Legal', 'Compliance'], risk: 'High' }],
    decision_questions: [{ question: 'Can the institution proceed within risk appetite after the identified protections are addressed?', owner: 'Matter owner', urgency: 'High' }],
    required_actions: obligations.map((item, index) => ({ id: `action-${index + 1}`, title: item.title, owner: item.owner, due: item.deadline, evidence_required: item.evidence_required })),
    missing_clauses: [],
    contradictions: [],
    regulatory_touchpoints: [],
    scenarios: [],
    challenge: { conclusion: 'Live senior challenge not completed.', false_positive_risk: 'High', omissions: ['Current-law verification', 'Cross-clause reasoning'] },
    source_verification: { status: 'Not performed', sources: [], limitation: 'No authoritative-source connector was used.' },
    assumptions_and_limits: ['Fallback results are not legal advice or regulatory certification.', failure || 'Live AI was not configured.'],
    analysis_details: { live_ai_used: false, independent_passes: 0, failure, characters_reviewed: text.length, generated_at: new Date().toISOString() }
  };
}

export async function analyzeDocument({ client, model, text, options }) {
  if (!client) return fallbackAnalysis(text, options, 'OPENAI_API_KEY is not configured.');

  try {
    const primary = await aiJson(client, model, `You are the primary institutional review engine for a regulated financial institution. Analyse only the supplied document. Identify clause-level and document-wide issues, evidence, materiality, institutional impact, affected stakeholders, mitigations and exact document-specific protective wording. Also identify parties, missing protections, contradictions, scenarios and regulatory touchpoints. Do not assert current law unless separately verified. Required JSON keys: document_summary, executive_position, findings[], missing_clauses[], contradictions[], actors[], regulatory_touchpoints[], scenarios[], assumptions_and_limits[]. Each finding must have risk_level, confidence, issue, clause_reference, quoted_text, institutional_impact, how_risk_may_materialise, recommended_mitigation, suggested_rewrite, review_owner[], affected_stakeholders[], materiality.`, text, options, 6500);

    const decision = await aiJson(client, model, `You are an independent decision and execution modeller. Convert the supplied evidence into a controlled institutional operating model. Return JSON keys: obligations[], permissions[], prohibitions[], triggers[], dependencies[], approval_gates[], decision_questions[], required_actions[], completion_evidence[], affected_entities[], affected_controls[], affected_products[], affected_processes[], affected_systems[], affected_teams[]. Each obligation must contain title, type, owner, trigger, deadline, status, risk, source_reference, evidence_required[]. Each required action must have title, owner, due, dependencies[], approval_gate, evidence_required[]. Never authorise autonomous high-risk execution.`, text, options, 5500);

    const challenge = await aiJson(client, model, `You are the independent senior challenge pass. Re-read the source from first principles. Test cross-clause interaction, false positives, omissions, underweighted exposure, commercial proportionality and whether the proposed decision can be defended to management, audit and a regulator. Return JSON keys: conclusion, confirmed_findings[], additional_findings[], downgraded_findings[], omissions[], dissent, recommended_decision, approval_conditions[], confidence.`, text, options, 4500);

    const findings = dedupe([...(primary.findings || []), ...(challenge.additional_findings || [])].map(normaliseFinding), 'issue');
    const average = findings.length ? findings.reduce((sum, item) => sum + severityScore(item.risk_level), 0) / findings.length : 35;
    const score = Math.max(1, Math.min(100, Math.round(average + Math.min(10, (challenge.omissions || []).length * 2))));
    const overall = score >= 85 ? 'Critical' : score >= 65 ? 'High' : score >= 40 ? 'Medium' : 'Low';

    return {
      engine: `Synesis live multipass (${model})`,
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
      missing_clauses: primary.missing_clauses || [],
      contradictions: primary.contradictions || [],
      regulatory_touchpoints: primary.regulatory_touchpoints || [],
      scenarios: primary.scenarios || [],
      affected_entities: decision.affected_entities || [],
      affected_controls: decision.affected_controls || [],
      affected_products: decision.affected_products || [],
      affected_processes: decision.affected_processes || [],
      affected_systems: decision.affected_systems || [],
      affected_teams: decision.affected_teams || [],
      challenge,
      source_verification: { status: 'Document-grounded only', sources: [], limitation: 'Current-law propositions require an authorised source pack or licensed connector.' },
      assumptions_and_limits: primary.assumptions_and_limits || [],
      analysis_details: { live_ai_used: true, independent_passes: 3, model, characters_reviewed: text.length, generated_at: new Date().toISOString() }
    };
  } catch (error) {
    return fallbackAnalysis(text, options, String(error.message || error).slice(0, 500));
  }
}

export async function answerDocumentQuestion({ client, model, document, question }) {
  const analysis = document.analysis || {};
  if (!client) {
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
    const ranked = (analysis.findings || []).map(item => ({ item, score: terms.reduce((s, term) => s + JSON.stringify(item).toLowerCase().includes(term), 0) })).sort((a, b) => b.score - a.score).slice(0, 5);
    return ranked.filter(x => x.score > 0).map(x => `${x.item.issue}: ${x.item.institutional_impact}\nEvidence: ${x.item.quoted_text}\nAction: ${x.item.recommended_mitigation}`).join('\n\n') || 'The active analysis does not contain enough evidence to answer reliably.';
  }
  const response = await client.responses.create({
    model,
    max_output_tokens: 1200,
    input: `Answer the question using only the active document and its analysis. Cite clause references and quoted evidence. State uncertainty. Do not use facts from other matters.\n\nQUESTION: ${question}\n\nDOCUMENT: ${document.sourceText}\n\nANALYSIS: ${JSON.stringify(analysis)}`
  });
  return response.output_text;
}
