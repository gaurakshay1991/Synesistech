import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_FILE = process.env.DATA_FILE || path.resolve(process.cwd(), 'server/data/live-synesis-store.json');

const emptyStore = {
  documents: [],
  audit: []
};

async function ensureStore() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyStore, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyStore, null, 2), 'utf8');
    return structuredClone(emptyStore);
  }
}

async function writeStore(store) {
  await ensureStore();
  const temp = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(temp, DATA_FILE);
}

function publicDocument(doc) {
  const { extractedText, ...safe } = doc;
  return safe;
}

export async function listDocuments() {
  const store = await readStore();
  return store.documents
    .map(publicDocument)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getDocument(id, includeText = false) {
  const store = await readStore();
  const doc = store.documents.find(item => item.id === id);
  if (!doc) return null;
  return includeText ? doc : publicDocument(doc);
}

export async function saveDocument(input) {
  const store = await readStore();
  const now = new Date().toISOString();
  const doc = {
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || now,
    updatedAt: now,
    status: input.status || 'AI Review Complete',
    decisions: input.decisions || [],
    ...input
  };
  const index = store.documents.findIndex(item => item.id === doc.id);
  if (index >= 0) store.documents[index] = doc;
  else store.documents.unshift(doc);
  await writeStore(store);
  return publicDocument(doc);
}

export async function updateDocument(id, updater) {
  const store = await readStore();
  const index = store.documents.findIndex(item => item.id === id);
  if (index < 0) return null;
  const next = typeof updater === 'function' ? updater(store.documents[index]) : { ...store.documents[index], ...updater };
  next.updatedAt = new Date().toISOString();
  store.documents[index] = next;
  await writeStore(store);
  return publicDocument(next);
}

export async function addDecision(id, decision) {
  return updateDocument(id, current => ({
    ...current,
    status: decision.status || current.status,
    decisions: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        findingId: decision.findingId || null,
        status: decision.status || 'Commented',
        comment: decision.comment || '',
        user: decision.user || 'Unknown'
      },
      ...(current.decisions || [])
    ]
  }));
}

export async function logAudit(entry) {
  const store = await readStore();
  store.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...entry });
  store.audit = store.audit.slice(0, 1000);
  await writeStore(store);
}

export async function listAudit() {
  const store = await readStore();
  return store.audit.slice(0, 300);
}

export async function dashboardMetrics() {
  const documents = await listDocuments();
  const highRisk = documents.filter(doc => doc.analysis?.overall_risk === 'High').length;
  const open = documents.filter(doc => !['Final Approved', 'Closed'].includes(doc.status)).length;
  const findings = documents.reduce((sum, doc) => sum + (doc.analysis?.findings?.length || 0), 0);
  const scenarios = documents.reduce((sum, doc) => sum + (doc.analysis?.scenario_tests?.length || 0), 0);
  const departments = {};
  for (const doc of documents) {
    for (const finding of doc.analysis?.findings || []) {
      for (const owner of finding.review_owner || []) departments[owner] = (departments[owner] || 0) + 1;
    }
  }
  return {
    totalDocuments: documents.length,
    highRisk,
    open,
    totalFindings: findings,
    totalScenarios: scenarios,
    ownerWorkload: Object.entries(departments).map(([owner, count]) => ({ owner, count })).sort((a, b) => b.count - a.count),
    recent: documents.slice(0, 6)
  };
}
