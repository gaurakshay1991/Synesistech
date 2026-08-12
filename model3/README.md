# SYNESIS Neuro-Symbolic Legal Intelligence Platform v4

Synesis is a governed legal, regulatory and risk-intelligence platform for regulated institutions, corporate legal teams, compliance functions and transaction professionals. It converts source documents and verified regulatory propositions into explainable clause findings, obligations, controls, decisions, actions, evidence and institutional memory.

## Neuro-symbolic architecture

1. **Document and NLP layer** — ingests PDF, DOCX, TXT, CSV, JSON, Markdown and XML; extracts and hashes source text.
2. **Symbolic legal-rule layer** — applies deterministic, versionable clause and control rules with explicit evidence and mitigation traces.
3. **Neural interpretation layer** — evaluates context, ambiguity, cross-clause interaction and document-specific drafting when an OpenAI API key is configured.
4. **Independent challenge and reconciliation** — tests both neural and symbolic outputs, records disagreement and produces a reconciled risk signal.
5. **Regulatory verification layer** — separates unverified regulatory propositions from source-verified legal conclusions and impact mappings.
6. **Clause Memory Graph** — records clause archetypes, variants, rules, outcomes and human-validated feedback without silently changing approved legal positions.
7. **Governed simulations** — institutional stress scenarios and clause-level dispute indicators with disclosed assumptions and confidence limits.

## Product workspaces

- Command Centre and attention queue
- Intake, document review and neuro-symbolic reasoning trace
- Regulatory Radar and impact propagation
- Clause Memory Graph
- Litigation Lab
- AI, ESG, privacy and model-risk governance
- Obligations, controls, decisions, approvals, tasks and evidence
- Institutional Decision Twin and solution packs
- Institutional Q&A
- Product, IP, roadmap and illustrative financial scenario studio
- Reports, assurance exports, user administration and audit trail

## Security and operating controls

- Organisation-scoped RBAC and mandatory first-login password replacement
- HttpOnly signed sessions and production reverse-proxy awareness
- AES-256-GCM encryption of extracted source text
- PostgreSQL persistence on hosted deployments; encrypted atomic JSON fallback for local use
- File signature validation, SHA-256 hashing and upload limits
- Corporate DLP block-page detection with no bypass capability
- Human approval gates for material decisions
- Explicit fallback disclosure, source provenance and immutable audit events
- Unsupported investor, founder, client, accuracy, award, patent and incorporation claims are blocked pending documentary verification

## Accuracy boundary

Synesis is decision-support software. It does not replace authorised legal advice, regulatory-source verification, patent counsel, investment due diligence or accountable human judgment. Litigation results are illustrative indicators, not court-outcome predictions. Financial scenarios are management assumptions, not forecasts or securities offerings.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Client: `http://localhost:5173`  
API: `http://localhost:3000`

## Validation

```bash
npm run check
```

This runs server regression tests and the production React build.

## Render deployment

The service uses the repository branch configured in Render, root directory `model3`, build command `npm install --no-audit --no-fund && npm run check`, start command `npm start`, and health endpoint `/api/health`.

Required secrets:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `JWT_SECRET`
- `DATA_ENCRYPTION_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY` for live neural passes

A free Render service/database is suitable only for a demonstration or short pilot. Institutional production requires paid durable infrastructure, backups, approved data residency, SSO/MFA, customer-managed security review, penetration testing, disaster recovery, model validation, source licensing and vendor-risk approval.
