import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { classifyProviderError } from './governance.js';

const FINAL_DOCUMENT_STATUSES = new Set(['Final Approved', 'Rejected', 'Closed']);
const AUTHORISED_FINAL_ROLES = new Set(['admin', 'legal', 'compliance', 'risk']);
const AUTHORISED_FINAL_ACTIONS = new Set(['Resolved', 'Accepted With Controls', 'Rejected']);

function sessionToken(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (bearer) return bearer;

  const cookies = String(req.headers.cookie || '').split(';');
  const session = cookies.find(item => item.trim().startsWith('synesis_session='));
  if (!session) return '';
  return decodeURIComponent(session.trim().slice('synesis_session='.length));
}

function verifiedClaims(req) {
  const raw = sessionToken(req);
  if (!raw || !config.jwtSecret) return null;
  try {
    return jwt.verify(raw, config.jwtSecret, {
      issuer: 'live-synesis',
      audience: 'live-synesis-web'
    });
  } catch {
    return null;
  }
}

function isPrivateAnalysisPath(req) {
  return req.method === 'POST' && (
    req.path === '/api/documents/analyze' ||
    /^\/api\/documents\/[0-9a-f-]+\/reanalyze$/i.test(req.path)
  );
}

function isPrivateAskPath(req) {
  return req.method === 'POST' && /^\/api\/documents\/[0-9a-f-]+\/ask$/i.test(req.path);
}

function isPrivateDecisionPath(req) {
  return req.method === 'POST' && /^\/api\/documents\/[0-9a-f-]+\/decision$/i.test(req.path);
}

export default function privateGovernanceMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/documents')) return next();

  if (isPrivateDecisionPath(req) && FINAL_DOCUMENT_STATUSES.has(req.body?.documentStatus)) {
    const claims = verifiedClaims(req);
    if (!claims) {
      return res.status(401).json({ error: 'A valid named reviewer session is required.' });
    }
    if (!AUTHORISED_FINAL_ROLES.has(claims.role)) {
      return res.status(403).json({
        error: 'Only an authorised Legal, Compliance, Risk or Administrator reviewer may set a final status.'
      });
    }
    if (!AUTHORISED_FINAL_ACTIONS.has(req.body?.status)) {
      return res.status(400).json({
        error: 'A final status requires the review action Resolved, Accepted With Controls, or Rejected.'
      });
    }
    if (String(req.body?.comment || '').trim().length < 30) {
      return res.status(400).json({
        error: 'Record a substantive human rationale of at least 30 characters before finalising the matter.'
      });
    }
  }

  const originalJson = res.json.bind(res);
  res.json = payload => {
    if (isPrivateAnalysisPath(req) && payload?.document) {
      const document = payload.document;
      const live = Boolean(document.analysis?.analysis_details?.live_ai_used);
      if (!live) {
        const failure = classifyProviderError({
          message: document.analysis?.analysis_details?.failure || 'Live analysis did not complete.'
        });
        res.status(503);
        return originalJson({
          error: failure.userMessage,
          code: failure.code,
          retryable: failure.retryable,
          operatorAction: failure.operatorAction,
          analysisCompleted: false,
          fallbackSuppressed: true,
          humanReviewRequired: true,
          document
        });
      }
      return originalJson({
        ...payload,
        analysisCompleted: true,
        humanReviewRequired: true,
        document: {
          ...document,
          status: document.status === 'AI Review Complete'
            ? 'Pending Human Review'
            : document.status
        }
      });
    }

    if (isPrivateAskPath(req) && /fallback|baseline/i.test(String(payload?.mode || ''))) {
      res.status(503);
      return originalJson({
        error: 'Document Q&A was not completed because the live reasoning provider is unavailable. Baseline text matching has been suppressed.',
        code: 'OPENAI_ANALYSIS_FAILED',
        analysisCompleted: false,
        fallbackSuppressed: true,
        humanReviewRequired: true
      });
    }

    return originalJson(payload);
  };

  next();
}
