import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_FILE = process.env.DATA_FILE || path.resolve(process.cwd(), 'server/data/live-synesis-store.json');
const ENCRYPTION_SECRET = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'live-synesis-development-only-key';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

const emptyStore = {
  documents: [],
  audit: []
};

function encryptText(value = '') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

function decryptText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (payload.algorithm !== 'aes-256-gcm') throw new Error('Unsupported stored document encryption format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function protectDocument(document) {
  const protectedDocument = { ...document };
  if (typeof protectedDocument.extractedText === 'string') {
    protectedDocument.encryptedText = encryptText(protectedDocument.extractedText);
    delete protectedDocument.extractedText;
  }
  return protectedDocument;
}

function materializeDocument(document, includeText = false) {
  const result = { ...document };
  const text = typeof result.extractedText === 'string'
    ? result.extractedText
    : decryptText(result.encryptedText);
  delete result.encryptedText;
  delete result.extractedText;
  if (includeText) result.extractedText = text;
  return result;
}

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
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : []
    };
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

export async function listDocuments() {
  const store = await readStore();
  return store.documents
    .map(document => materializeDocument(document, false))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getDocument(id, includeText = false) {
  const store = await readStore();
  const document = store.documents.find(item => item.id === id);
  return document ? materializeDocument(document, includeText) : null;
}

export async function saveDocument(input) {
  const store = await readStore();
  const now = new Date().toISOString();
  const document = {
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || now,
    updatedAt: now,
    status: input.status || 'AI Review Complete',
    decisions: input.decisions || [],
    ...input
  };
  const index = store.documents.findIndex(item => item.id === document.id);
  const protectedDocument = protectDocument(document);
  if (index >= 0) store.documents[index] = protectedDocument;
  else store.documents.unshift(protectedDocument);
  await writeStore(store);
  return materializeDocument(protectedDocument, false);
}

export async function updateDocument(id, updater) {
  const store = await readStore();
  const index = store.documents.findIndex(item => item.id === id);
  if (index < 0) return null;
  const current = materializeDocument(store.documents[index], true);
  const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
  next.updatedAt = new Date().toISOString();
  const protectedDocument = protectDocument(next);
  store.documents[index] = protectedDocument;
  await writeStore(store);
  return materializeDocument(protectedDocument, false);
}

export async function deleteDocument(id) {
  const store = await readStore();
  const index = store.documents.findIndex(item => item.id === id);
  if (index < 0) return false;
  store.documents.splice(index, 1);
  await writeStore(store);
  return true;
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
  const highRisk = documents.filter(document => document.analysis?.overall_risk === 'High').length;
  const open = documents.filter(document => !['Final Approved', 'Closed'].includes(document.status)).length;
  const findings = documents.reduce((sum, document) => sum + (document.analysis?.findings?.length || 0), 0);
  const scenarios = documents.reduce((sum, document) => sum + (document.analysis?.scenario_tests?.length || 0), 0);
  const departments = {};
  for (const document of documents) {
    for (const finding of document.analysis?.findings || []) {
      for (const owner of finding.review_owner || []) departments[owner] = (departments[owner] || 0) + 1;
    }
  }
  return {
    totalDocuments: documents.length,
    highRisk,
    open,
    totalFindings: findings,
    totalScenarios: scenarios,
    ownerWorkload: Object.entries(departments)
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count),
    recent: documents.slice(0, 6)
  };
}
