const MAX_EVIDENCE_LENGTH = 420;

function text(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function clipped(value, limit = MAX_EVIDENCE_LENGTH) {
  const valueText = text(value);
  return valueText.length > limit ? `${valueText.slice(0, limit - 1).trimEnd()}…` : valueText;
}

function itemTitle(item) {
  if (typeof item === 'string') return item;
  return text(item?.issue || item?.finding || item?.title || item?.finding_id || item?.findingId || item?.requirement || item?.action, 'Unspecified item');
}

function itemReason(item) {
  if (typeof item === 'string') return '';
  return text(item?.why || item?.rationale || item?.reason || item?.impact || item?.description || item?.requirement);
}

function bulletList(lines, heading, items = []) {
  const usable = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!usable.length) return;
  lines.push('', `### ${heading}`);
  for (const item of usable.slice(0, 12)) {
    lines.push(`- ${itemTitle(item)}${itemReason(item) ? ` — ${clipped(itemReason(item), 320)}` : ''}`);
  }
}

function citationLines(analysis, decisionPack) {
  const candidates = [
    ...(analysis?.live_current_law?.citations || []),
    ...(analysis?.regulatory_impact?.currentLawCitations || []),
    ...(decisionPack?.currentLawCitations || [])
  ];
  const seen = new Set();
  return candidates
    .map(item => ({ title: text(item?.title || item?.name || item?.url), url: text(item?.url) }))
    .filter(item => item.url && !seen.has(item.url) && (seen.add(item.url) || true))
    .slice(0, 12);
}

function firstArray(...values) {
  return values.find(Array.isArray) || [];
}

/**
 * Creates an evidence-bound handoff brief for one selected matter. The source
 * document itself is deliberately excluded; only the current analysis and
 * approved user-facing outputs are included.
 */
export function createMatterDecisionBrief({ document, decisionPack = null, tasks = [], generatedAt = new Date().toISOString() } = {}) {
  if (!document) throw new Error('A selected matter is required to create a decision brief.');

  const analysis = document.analysis || {};
  const details = analysis.analysis_details || {};
  const currentLaw = analysis.live_current_law || {};
  const regulatory = analysis.regulatory_impact || {};
  const exposure = analysis.exposure_model || {};
  const findings = firstArray(analysis.findings, analysis.material_findings);
  const exposureItems = firstArray(exposure.exposures, exposure.findings);
  const lines = [
    '# SYNESIS 3.0 — Matter Decision Brief',
    '',
    `Generated: ${generatedAt}`,
    'Status: Decision-support record. It is not an approval, legal opinion, or substitute for authorised human review.',
    '',
    '## Scope and provenance',
    `- Matter: ${text(document.matter, 'Not specified')}`,
    `- Document: ${text(document.title, 'Untitled document')}`,
    `- Jurisdiction: ${text(document.jurisdiction, 'Not specified')}`,
    `- Document type: ${text(document.documentType, 'Not specified')}`,
    `- Matter isolation: ${text(details.document_isolation, 'single selected document')}`,
    `- Analysis engine: ${text(analysis.engine, text(details.ai_provider, 'Not recorded'))}`,
    `- Live neural analysis: ${details.live_ai_used === true ? 'used' : 'not confirmed'}`,
    `- Current-law verification: ${details.current_law_web_used === true || currentLaw.liveWebUsed === true ? 'live source check used' : text(currentLaw.status, 'not verified')}`,
    '',
    '## Executive position',
    text(analysis.executive_position || analysis.document_summary || analysis.recommended_decision, 'No document-derived executive position is currently recorded.'),
    `- Overall risk: ${text(analysis.overall_risk || document.overallRisk, 'Unassessed')}`,
    `- Analysis score: ${analysis.overall_score ?? document.score ?? 'Not recorded'}/100`,
    `- Recommended disposition: ${text(analysis.recommended_decision, 'Run the clearance decision before relying on a disposition.')}`,
    '',
    '## Clearance decision',
    decisionPack
      ? `- Overall disposition: ${text(decisionPack.overall_disposition, 'Not recorded')}`
      : '- Clearance decision has not yet been run for this matter.',
    decisionPack ? `- Recommendation: ${text(decisionPack.clearance_recommendation, 'Not recorded')}` : '',
    decisionPack ? `- Rationale: ${text(decisionPack.executive_rationale, 'Not recorded')}` : ''
  ].filter(Boolean);

  if (decisionPack?.regulatory_clearance_effect) lines.push(`- Regulatory clearance effect: ${text(decisionPack.regulatory_clearance_effect)}`);
  bulletList(lines, 'Must fix', decisionPack?.must_fix);
  bulletList(lines, 'Raise / negotiate', decisionPack?.raise_and_negotiate);
  bulletList(lines, 'Accept with note', decisionPack?.acceptable_with_note);
  bulletList(lines, 'Let go', decisionPack?.let_go);

  lines.push('', '## Document-derived findings');
  if (!findings.length) {
    lines.push('No document-derived findings are recorded. Re-run the matter rather than inserting generic findings.');
  } else {
    for (const finding of findings.slice(0, 16)) {
      lines.push('', `### ${text(finding.issue || finding.title, 'Finding')}`);
      lines.push(`- Risk: ${text(finding.risk_level || finding.risk || finding.severity, 'Unassessed')}`);
      if (finding.clause_reference || finding.category) lines.push(`- Reference: ${text(finding.clause_reference || finding.category)}`);
      if (finding.quoted_text) lines.push(`- Evidence: “${clipped(finding.quoted_text)}”`);
      if (finding.institutional_impact || finding.why_it_matters) lines.push(`- Why it matters: ${clipped(finding.institutional_impact || finding.why_it_matters, 360)}`);
      if (finding.recommended_mitigation || finding.mitigation) lines.push(`- Existing mitigation: ${clipped(finding.recommended_mitigation || finding.mitigation, 360)}`);
    }
  }

  lines.push('', '## Regulatory and current-law position');
  lines.push(`- Regulatory impact: ${text(regulatory.overallImpact || regulatory.status, 'Not assessed')}`);
  lines.push(`- Stale / changed authority warning: ${regulatory.staleReferenceWarning ? 'Yes — treat as a clearance issue.' : 'No warning recorded.'}`);
  if (currentLaw.answer || currentLaw.error) lines.push(`- Current-law result: ${clipped(currentLaw.answer || currentLaw.error, 700)}`);

  const citedAuthorities = regulatory.citedAuthorities || [];
  if (citedAuthorities.length) {
    lines.push('', '### Authority freshness');
    for (const authority of citedAuthorities.slice(0, 12)) {
      lines.push(`- ${text(authority.documentReference || authority.currentInstrument, 'Authority')} — ${text(authority.currentStatus, 'Status not established')}${authority.amendmentOrSupersession ? `; ${clipped(authority.amendmentOrSupersession, 220)}` : ''}`);
    }
  }
  bulletList(lines, 'Material compliance actions', regulatory.requiredActions);

  lines.push('', '## Exposure discipline');
  if (!exposureItems.length) {
    lines.push('No defensible exposure model is recorded. Severity must not be converted into a monetary value without a contractual or verified legal basis.');
  } else {
    for (const item of exposureItems.slice(0, 12)) {
      lines.push(`- ${text(item.category || item.issue, 'Exposure item')}: ${text(item.quantificationStatus, 'Not reliably quantifiable')} — ${text(item.exposureLabel || item.financialExposure, 'No monetary label recorded')}${item.rationale ? `; ${clipped(item.rationale, 240)}` : ''}`);
    }
  }

  const matterTasks = (Array.isArray(tasks) ? tasks : []).filter(task => task.documentId === document.id);
  lines.push('', '## Actions and accountable follow-through');
  if (!matterTasks.length) {
    lines.push('No matter-specific execution tasks are currently recorded.');
  } else {
    for (const task of matterTasks.slice(0, 16)) {
      lines.push(`- [${text(task.status, 'Not started')}] ${text(task.title, 'Untitled action')} — Owner: ${text(task.owner, 'Not assigned')}; Due: ${text(task.due, 'Not scheduled')}`);
    }
  }

  const citations = citationLines(analysis, decisionPack);
  if (citations.length) {
    lines.push('', '## Current-law sources consulted');
    for (const citation of citations) lines.push(`- [${citation.title}](${citation.url})`);
  }

  return `${lines.join('\n').trim()}\n`;
}

export function matterDecisionBriefFileName(document) {
  const base = text(document?.title, 'matter')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'matter';
  return `synesis-${base}-decision-brief.md`;
}

export function downloadMatterDecisionBrief(brief, fileName) {
  const blob = new Blob([brief], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
