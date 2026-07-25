import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import privateGovernanceMiddleware from '../src/private-governance-middleware.js';

function token(role = 'admin') {
  return jwt.sign({
    sub: '11111111-1111-4111-8111-111111111111',
    org: '22222222-2222-4222-8222-222222222222',
    email: `${role}@synesis.test`,
    role,
    name: role
  }, config.jwtSecret, {
    expiresIn: '10m',
    issuer: 'live-synesis',
    audience: 'live-synesis-web'
  });
}

function responseHarness() {
  const result = { statusCode: 200, payload: null };
  const res = {
    status(code) {
      result.statusCode = code;
      return res;
    },
    json(payload) {
      result.payload = payload;
      return payload;
    }
  };
  return { res, result };
}

function decisionRequest(role, overrides = {}) {
  return {
    method: 'POST',
    path: '/api/documents/33333333-3333-4333-8333-333333333333/decision',
    headers: { authorization: `Bearer ${token(role)}` },
    body: {
      documentStatus: 'Final Approved',
      status: 'Resolved',
      comment: 'The authorised reviewer verified the evidence and accepts the stated controls.',
      ...overrides
    }
  };
}

test('business users cannot finalise a consequential decision', () => {
  const req = decisionRequest('business');
  const { res, result } = responseHarness();
  let nextCalled = false;

  privateGovernanceMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.match(result.payload.error, /authorised/i);
});

test('final decisions require a substantive human rationale', () => {
  const req = decisionRequest('legal', { comment: 'Approved.' });
  const { res, result } = responseHarness();
  let nextCalled = false;

  privateGovernanceMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.error, /at least 30 characters/i);
});

test('authorised reviewers with a valid action and rationale pass to database enforcement', () => {
  const req = decisionRequest('compliance');
  const { res, result } = responseHarness();
  let nextCalled = false;

  privateGovernanceMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test('private baseline Q&A is suppressed rather than returned as a live answer', () => {
  const req = {
    method: 'POST',
    path: '/api/documents/33333333-3333-4333-8333-333333333333/ask',
    headers: {},
    body: {}
  };
  const { res, result } = responseHarness();

  privateGovernanceMiddleware(req, res, () => {
    res.json({ answer: 'baseline match', mode: 'document-baseline-fallback' });
  });

  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.fallbackSuppressed, true);
  assert.equal(result.payload.analysisCompleted, false);
  assert.equal(result.payload.answer, undefined);
});
