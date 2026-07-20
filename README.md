# LIVE SYNESIS

LIVE SYNESIS is an AI-native institutional decision intelligence and execution platform for regulated and capital-intensive organisations.

It sits above and between fragmented systems of record and converts documents, obligations, entities, controls, evidence, people and institutional data into explainable decisions, governed actions and durable decision memory.

Legal intelligence is a horizontal capability inside the platform. It is not the platform category.

## Product promise

LIVE SYNESIS should know what the organisation is required or permitted to do, explain why, identify what and who are affected, surface the decision that must be made, route the approved response, prove completion and learn from the result.

For an asset manager, that means helping the institution understand what it owns, why it owns it, whether each decision remains within mandate and in investors’ or unit-holders’ interests, what risks capital faces and what action must occur next.

For a bank or regulated enterprise, it means connecting contractual, regulatory, financial-crime, privacy, cyber, operational-resilience, governance, authority, financial and reputational consequences into one controlled decision path.

## Current production-pilot capabilities

- Task-first responsive workspace for Admin, Legal, Compliance, KYC/AML, Risk, Business and Management roles
- Secure PDF, DOCX, TXT, CSV, JSON, Markdown and XML ingestion, plus pasted text
- File-signature validation, binary-content rejection and SHA-256 content fingerprints
- Live OpenAI analysis of the actual uploaded document using strict structured output
- Independent multipass review: primary analysis, decision/execution modelling and senior challenge pass
- Explicit analysis provenance showing whether live AI or the emergency deterministic fallback produced the result
- Clause evidence, severity, confidence, institutional impact, mitigation, document-specific rewrites and ownership
- Parties/entities, obligations, triggers, deadlines, dependencies, approval gates, required evidence and stakeholder impact
- Missing-protection, contradiction, regulatory-touchpoint and document-grounded scenario analysis
- Active-document Q&A that does not mix evidence between matters
- Review decisions, status workflow, audit trail and role-controlled administration
- Side-by-side risk comparison and downloadable text/JSON/print-to-PDF reports
- Tenant-scoped Neon Postgres persistence with AES-256-GCM encryption for extracted source text
- HttpOnly cookie sessions, password hashing, mandatory temporary-password replacement, rate limits and security headers
- Vercel serverless deployment and single-process Replit operation

## Analysis architecture

The live analysis path does not begin from a stored list of answers.

1. The uploaded document is extracted and treated as untrusted evidence.
2. A primary reasoning pass reads the document from first principles and produces evidence-linked findings.
3. A separate decision-intelligence pass converts the document into actors, obligations, triggers, dependencies, decision questions, approval gates, actions and completion evidence.
4. In deep mode, an independent challenge pass rereads the document, tests cross-clause interaction and attempts to identify false positives, omissions and underweighted exposure.
5. The platform deduplicates and reconciles the independent passes.
6. When enabled, current legal or regulatory propositions are checked separately against authoritative current sources.
7. Only when live reasoning is unavailable does the deterministic emergency fallback operate. A fallback result is clearly labelled and must not be represented as the completed Synesis analysis.

The platform records the model, analysis mode, number of reasoning passes, characters reviewed, source-verification status and any provider failure.

## Solution architecture

The platform is designed to grow through connected solution packs rather than disconnected dashboards:

- Synesis Decision Core: intake, institutional graph, workflows, approvals, evidence, search, collaboration and Decision Memory
- Contract Command: review, drafting, negotiation, playbooks, obligations, renewals, performance and value assurance
- Regulatory Command: change monitoring, impact mapping, control mapping, remediation, evidence and regulator-ready reporting
- Governance and Authority: entities, ownership, signatories, delegations, board approvals and statutory obligations
- Capital and Mandate Intelligence: holdings rationale, mandate limits, investor-interest tests, liquidity, valuation, conflicts and action tracking
- Disputes and Investigations: chronology, evidence graph, privilege, witnesses, settlement scenarios and investigation workflow
- Transactions: diligence, issue lists, approvals, conditions precedent, closing and post-closing obligations
- Synesis Agent Studio: governed reusable agents, skills and workflow orchestration
- Synesis AI Control Tower: models, agents, prompts, data, permissions, evaluations, security, cost and performance

## What LIVE SYNESIS is not attempting to replace initially

The initial product is not a complete trading terminal, order-management system, market-data business, proprietary risk-model library, fund-accounting engine, transfer-agency platform or universal legal-content database.

It is the intelligence, governance and execution layer that connects those systems, identifies what requires a decision and controls the approved next action. Selected systems of record can be replaced later only where Synesis develops a demonstrably superior capability.

## Technical architecture

- `client/`: React 19 and Vite interface
- `server/`: Express API, authentication, analysis, document parsing and Neon persistence
- `api/index.js`: Vercel serverless entry point
- `server/schema.sql`: idempotent Neon Postgres schema
- `server/test/`: analysis, fallback-provenance and upload-safety regression tests

Original uploaded files are processed in memory and are not retained. Extracted text is encrypted before persistence. Public document responses exclude source text unless a server-side analysis operation explicitly requires it.

## Required environment variables

Copy `.env.example` for local development. In Vercel or Replit, place all values in the platform secret manager.

```text
DATABASE_URL
JWT_SECRET
DATA_ENCRYPTION_KEY
BOOTSTRAP_ADMIN_NAME
BOOTSTRAP_ADMIN_EMAIL
BOOTSTRAP_ADMIN_PASSWORD
SYNESIS_ORGANIZATION_NAME
SYNESIS_ORGANIZATION_SLUG
OPENAI_API_KEY
OPENAI_MODEL
```

`JWT_SECRET` and `DATA_ENCRYPTION_KEY` must be independent stable random values of at least 32 characters. The OpenAI key is required for completed live analysis. Without it, or when the live provider fails, the platform operates only in explicitly labelled emergency-fallback mode.

## Local operation

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Development defaults to `http://localhost:5173` for the client and `http://localhost:3000` for the API. Set `CLIENT_ORIGIN=http://localhost:5173`.

## Replit operation

The included `.replit` configuration installs dependencies, builds the client and runs the unified Express process on port 3000. Add the required values as Replit Secrets, then press **Run**.

## Vercel operation

`vercel.json` builds `client/dist`, serves the SPA through Vercel's CDN and routes `/api/*` to the Express serverless entry point. Add the same production secrets to the Vercel project before promotion.

## Verification

```bash
npm run check
```

The suite verifies materially different outcomes for defective and corrected agreements, clause-specific incident-notification behaviour, document-specific analysis, adverse-language handling, live multipass orchestration, explicit fallback disclosure, text normalisation, content hashing, file-signature validation and binary-file rejection. GitHub Actions repeats the tests and production build on pull requests and changes to `main`.

## Operating boundary

LIVE SYNESIS provides governed institutional decision support. It does not autonomously execute high-risk legal, regulatory, investment, customer or capital actions. Such actions require configurable approval gates and authorised human accountability.

Before processing real institutional data, the deploying organisation must complete its own hosting, privacy, security, model-risk, data-residency, retention, backup, monitoring, penetration-testing, vendor-risk and regulatory approvals.
