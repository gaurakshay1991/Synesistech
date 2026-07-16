# LIVE SYNESIS 3

LIVE SYNESIS is a secure, document-first legal and compliance review platform for banks and regulated teams. Users upload or paste an agreement, receive clause-level risk analysis grounded in that document, collaborate on decisions, compare versions and generate a decision-ready report.

## Production-pilot capabilities

- Task-first responsive workspace for Admin, Legal, Compliance, KYC/AML, Risk, Business and Management roles
- Secure PDF, DOCX, TXT, CSV, JSON, Markdown and XML ingestion, plus pasted text
- File-signature validation, binary-content rejection and SHA-256 content fingerprints
- Structured OpenAI analysis with a deterministic document-specific fallback
- Clause evidence, severity, confidence, Bank impact, mitigation, protective rewrites and ownership
- Missing-protection, regulatory-touchpoint and document-grounded scenario analysis
- Active-document Q&A that does not mix evidence between matters
- Review decisions, status workflow, audit trail and role-controlled administration
- Side-by-side risk comparison and downloadable text/JSON/print-to-PDF reports
- Tenant-scoped Neon Postgres persistence with AES-256-GCM encryption for extracted source text
- HttpOnly cookie sessions, password hashing, mandatory temporary-password replacement, rate limits and security headers
- Vercel serverless deployment and single-process Replit operation

## Architecture

- `client/`: React 19 and Vite interface
- `server/`: Express API, authentication, analysis, document parsing and Neon persistence
- `api/index.js`: Vercel serverless entry point
- `server/schema.sql`: idempotent Neon Postgres schema
- `server/test/`: analysis and upload-safety regression tests

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

`JWT_SECRET` and `DATA_ENCRYPTION_KEY` must be independent random values of at least 32 characters and must remain stable. The OpenAI key is optional at runtime: if it is absent, unavailable or out of quota, the platform continues with the tested baseline engine and identifies the result as a fallback.

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

The suite verifies materially different risk outcomes for defective and corrected agreements, clause-specific incident-notification behaviour, document-specific analysis, adverse-language handling, text normalisation, content hashing, file-signature validation and binary-file rejection. GitHub Actions repeats the tests and production build on pushes and pull requests to `main`.

## Operating boundary

LIVE SYNESIS provides decision support, not autonomous legal advice or regulatory certification. Final decisions and current-law verification remain with authorised Legal, Compliance, Cybersecurity, KYC/AML, Risk and management personnel. Before processing real customer or bank data, the deploying institution must complete its own hosting, privacy, security, model-risk, retention, backup, monitoring, penetration-testing and regulatory approvals.
