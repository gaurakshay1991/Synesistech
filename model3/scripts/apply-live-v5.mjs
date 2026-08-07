import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd().endsWith('model3') ? process.cwd() : path.join(process.cwd(), 'model3');

function patch(relative, changes) {
  const file = path.join(root, relative);
  let value = fs.readFileSync(file, 'utf8');
  for (const [from, to] of changes) {
    if (!value.includes(from)) throw new Error(`Patch anchor not found in ${relative}: ${from.slice(0, 120)}`);
    value = value.replace(from, to);
  }
  fs.writeFileSync(file, value);
}

patch('server/src/index.js', [
  [
    "import { extractText, analyzeDocument, answerDocumentQuestion } from './analysis.js';",
    "import { extractText, analyzeDocument, answerDocumentQuestion } from './analysis.js';\nimport { registerLiveRoutes } from './live-routes.js';"
  ],
  [
    "app.patch('/api/documents/:id/status', auth, route(async (req, res) => {",
    "registerLiveRoutes({ app, auth, allow, route, openai });\n\napp.patch('/api/documents/:id/status', auth, route(async (req, res) => {"
  ]
]);

patch('client/src/App.jsx', [
  [
    "import { RegulatoryRadar, ClauseMemory, LitigationLab, GovernanceHub, VentureStudio } from './screens-neurosymbolic.jsx';",
    "import { RegulatoryRadar, ClauseMemory, LitigationLab, GovernanceHub, VentureStudio } from './screens-neurosymbolic.jsx';\nimport { LiveBrain } from './screens-livebrain.jsx';"
  ],
  [
    "['documents', 'Intake & Documents', FilePlus2], ['review', 'Review Centre', FileSearch2],\n  ['regulatory', 'Regulatory Radar', Globe2]",
    "['documents', 'Intake & Documents', FilePlus2], ['review', 'Review Centre', FileSearch2],\n  ['livebrain', 'Live Legal Brain', BrainCircuit], ['regulatory', 'Regulatory Radar', Globe2]"
  ],
  [
    "{page === 'review' && <Review active={activeDocument} documents={documents} onOpen={openDocument} request={request} setActive={setActiveDocument} setNotice={setNotice} />}\n        {page === 'regulatory'",
    "{page === 'review' && <Review active={activeDocument} documents={documents} onOpen={openDocument} request={request} setActive={setActiveDocument} setNotice={setNotice} />}\n        {page === 'livebrain' && <LiveBrain {...common} documents={documents} activeDocument={activeDocument} onOpenDocument={openDocument} />}\n        {page === 'regulatory'"
  ],
  [
    "<span>NEURO-SYMBOLIC v4</span>",
    "<span>LIVE LEGAL BRAIN v5</span>"
  ]
]);

patch('server/src/seed.js', [
  ["schemaVersion: 4,", "schemaVersion: 5,"],
  [
    "edition: 'Neuro-Symbolic Legal Intelligence Platform',",
    "edition: 'Live Neuro-Symbolic Legal Intelligence Platform',"
  ],
  [
    "simulationCount: 4\n  },",
    "simulationCount: 4,\n    liveSources: 0,\n    liveChanges24h: 0\n  },"
  ],
  [
    "  sources: [",
    "  liveBrain: {\n    status: 'Configured — awaiting first autonomous sync',\n    lastSyncAt: null,\n    lastDetectedCount: 0,\n    monitoredBackgroundSources: 0,\n    queryTimeSources: 0,\n    watchedUrls: 0,\n    isolationPolicy: 'Every document live-analysis run is isolated from every other document and matter.'\n  },\n  liveWatchlist: [],\n  sources: ["
  ]
]);

patch('package.json', [
  ["\"name\":\"synesis-new-model-3\",\"version\":\"3.0.0\"", "\"name\":\"synesis-live-legal-brain\",\"version\":\"5.0.0\""]
]);

console.log('Applied Synesis Live Legal Brain v5 integration patches.');
