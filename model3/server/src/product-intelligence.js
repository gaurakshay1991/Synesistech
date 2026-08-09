function clean(value, fallback = '', max = 1000) {
  return String(value ?? fallback).trim().slice(0, max);
}

function riskRank(value = '') {
  return ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[value] || 0);
}

export function materialityBand(finding = {}) {
  const risk = finding.risk_level || finding.risk || finding.severity || 'Medium';
  const confidence = Number(finding.confidence || finding.confidence_score || 0);
  if (risk === 'Critical') return 'MUST_FIX';
  if (risk === 'High' && confidence >= 70) return 'RAISE';
  if (risk === 'High') return 'REVIEW';
  if (risk === 'Medium' && confidence >= 80) return 'RAISE_IF_MATERIAL';
  if (risk === 'Medium') return 'MONITOR';
  return 'LET_GO';
}

export function buildDocumentGraph(document = {}) {
  const analysis = document.analysis || {};
  const nodes = [];
  const edges = [];
  const addNode = node => {
    if (!node?.id || nodes.some(item => item.id === node.id)) return;
    nodes.push(node);
  };
  const addEdge = (from, to, relation) => {
    if (!from || !to || edges.some(item => item.from === from && item.to === to && item.relation === relation)) return;
    edges.push({ from, to, relation });
  };

  const docId = `document:${document.id}`;
  addNode({ id: docId, type: 'Document', label: document.title || 'Untitled document', risk: analysis.overall_risk || document.overallRisk || 'Unassessed' });

  (analysis.findings || []).forEach((finding, index) => {
    const findingId = `finding:${finding.id || index}`;
    addNode({
      id: findingId,
      type: 'Finding',
      label: clean(finding.issue || finding.title, `Finding ${index + 1}`, 220),
      risk: finding.risk_level || finding.risk || finding.severity || 'Medium',
      confidence: Number(finding.confidence || finding.confidence_score || 0),
      disposition: materialityBand(finding)
    });
    addEdge(docId, findingId, 'HAS_FINDING');

    const quote = clean(finding.quoted_text || finding.evidence, '', 1400);
    const reference = clean(finding.clause_reference || finding.clause_label || finding.category, 'Document-wide', 220);
    if (quote) {
      const clauseId = `clause:${finding.id || index}`;
      addNode({ id: clauseId, type: 'Clause', label: reference, text: quote, category: clean(finding.category, 'General', 120) });
      addEdge(findingId, clauseId, 'GROUNDED_IN');
    }

    if (finding.category) {
      const categoryId = `category:${clean(finding.category, 'general', 120).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      addNode({ id: categoryId, type: 'ClauseCategory', label: clean(finding.category, 'General', 120) });
      addEdge(findingId, categoryId, 'CLASSIFIED_AS');
    }
  });

  (analysis.obligations || []).forEach((item, index) => {
    const id = `obligation:${item.id || index}`;
    addNode({ id, type: 'Obligation', label: clean(item.title, `Obligation ${index + 1}`, 220), risk: item.risk || 'Medium', owner: clean(item.owner, 'Unassigned', 120) });
    addEdge(docId, id, 'CREATES_OBLIGATION');
  });

  (analysis.actors || []).forEach((item, index) => {
    const label = typeof item === 'string' ? item : (item.name || item.actor || item.label);
    if (!label) return;
    const id = `actor:${index}:${clean(label, '', 100).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    addNode({ id, type: 'Actor', label: clean(label, '', 160) });
    addEdge(docId, id, 'INVOLVES');
  });

  (analysis.regulatory_touchpoints || []).forEach((item, index) => {
    const label = typeof item === 'string' ? item : (item.title || item.rule || item.authority || item.name);
    if (!label) return;
    const id = `regulation:${index}:${clean(label, '', 100).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    addNode({ id, type: 'RegulatoryTouchpoint', label: clean(label, '', 180) });
    addEdge(docId, id, 'TOUCHES');
  });

  (analysis.rewrite_candidates || []).forEach((item, index) => {
    const id = `rewrite:${index}`;
    addNode({ id, type: 'RewriteCandidate', label: clean(item.issue || item.category, `Rewrite ${index + 1}`, 180), text: clean(item.proposedText, '', 1600) });
    addEdge(docId, id, 'HAS_REWRITE');
  });

  return { documentId: document.id, generatedAt: new Date().toISOString(), nodes, edges };
}

export function buildClauseMemory(document = {}) {
  const analysis = document.analysis || {};
  return (analysis.findings || []).map((finding, index) => ({
    id: `memory:${document.id}:${finding.id || index}`,
    documentId: document.id,
    findingId: finding.id || `finding-${index + 1}`,
    category: clean(finding.category, 'General', 120),
    clauseReference: clean(finding.clause_reference, 'Document-wide', 220),
    sourceClause: clean(finding.quoted_text || finding.evidence, '', 1600),
    issue: clean(finding.issue, 'Review point', 300),
    risk: finding.risk_level || finding.risk || 'Medium',
    confidence: Number(finding.confidence || 0),
    dispositionHint: materialityBand(finding),
    suggestedRewrite: clean(finding.suggested_rewrite, '', 1800),
    mitigation: clean(finding.recommended_mitigation, '', 1200),
    fingerprint: analysis.analysis_details?.clause_fingerprint || analysis.neuro_symbolic?.symbolic?.clause_fingerprint || null,
    status: 'Candidate — not institutional memory until human-approved'
  }));
}

export function operationalStateFromDocuments(rawState = {}, documents = []) {
  const docIds = new Set(documents.map(item => item.id));
  const byDocument = list => (list || []).filter(item => item.documentId && docIds.has(item.documentId));
  const liveRegulatory = (rawState.regulatoryUpdates || []).filter(item => {
    const ref = String(item.sourceReference || item.url || '');
    const title = String(item.title || '');
    return /^https:\/\//i.test(ref) && !/sample assessment|demonstration/i.test(title);
  });

  const graphs = documents.map(buildDocumentGraph);
  const graph = {
    nodes: graphs.flatMap(item => item.nodes),
    edges: graphs.flatMap(item => item.edges)
  };
  const clauseMemoryCandidates = documents.flatMap(buildClauseMemory);
  const tasks = byDocument(rawState.tasks);
  const obligations = byDocument(rawState.obligations);
  const decisions = byDocument(rawState.decisions);

  const alerts = documents.flatMap(document => {
    const analysis = document.analysis || {};
    return (analysis.findings || [])
      .filter(item => ['Critical', 'High'].includes(item.risk_level || item.risk || item.severity))
      .slice(0, 8)
      .map((item, index) => ({
        id: `alert:${document.id}:${item.id || index}`,
        documentId: document.id,
        severity: item.risk_level || item.risk || item.severity,
        title: clean(item.issue, 'Material document risk', 240),
        owner: (item.review_owner || []).join(' / ') || 'Legal',
        due: 'Review now',
        why: clean(item.institutional_impact, 'Material risk requires review.', 500),
        next: materialityBand(item)
      }));
  });

  const metrics = {
    attention: alerts.length + decisions.filter(item => !['Approved', 'Rejected', 'Closed'].includes(item.status)).length,
    critical: alerts.filter(item => item.severity === 'Critical').length,
    overdue: 0,
    decisionsPending: decisions.filter(item => ['Pending', 'Challenge', 'Deferred'].includes(item.status)).length,
    controlsAtRisk: 0,
    evidenceCoverage: 0,
    averageCycleDays: 0,
    preventedExposure: 0,
    regulatoryUpdatesOpen: liveRegulatory.length,
    clauseMemoryCoverage: clauseMemoryCandidates.length,
    governanceReadiness: 0,
    simulationCount: byDocument(rawState.litigationSimulations).length,
    liveSources: Number(rawState.liveBrain?.monitoredBackgroundSources || 0),
    liveChanges24h: Number(rawState.liveBrain?.lastDetectedCount || 0)
  };

  return {
    ...rawState,
    metrics,
    alerts,
    obligations,
    decisions,
    tasks,
    controls: [],
    evidence: [],
    memories: [],
    impacts: [],
    regulatoryUpdates: liveRegulatory,
    clauseMemory: {
      coverage: clauseMemoryCandidates.length,
      archetypes: [],
      edges: [],
      feedbackEvents: (rawState.clauseMemory?.feedbackEvents || []).filter(item => item.documentId && docIds.has(item.documentId)),
      candidates: clauseMemoryCandidates
    },
    graph,
    litigationSimulations: byDocument(rawState.litigationSimulations),
    demoContentSuppressed: true,
    operationalDataPolicy: 'Document-derived and live-source data only. Seed/demo institutional content is excluded from the operational console.'
  };
}

export function exposureForFinding(exposureModel = {}, finding = {}, index = 0) {
  const list = exposureModel.exposures || exposureModel.findings || [];
  const id = finding.id || `finding-${index + 1}`;
  return list.find(item => item.findingId === id || item.id === id || item.issue === finding.issue) || null;
}
