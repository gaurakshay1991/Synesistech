# LIVE SYNESIS 2.1

LIVE SYNESIS is a document-led legal and compliance operating platform designed initially for banks and other regulated financial institutions.

The uploaded document is the source of truth. The platform extracts the actual file, identifies clauses and sections, detects risks, gaps, contradictions and missing protections, explains why each issue is risky for the Bank, assigns High/Medium/Low risk and a numerical score, recommends mitigation, rewrites clauses, generates document-specific scenarios and produces a decision-ready report.

## Working private-pilot capabilities

- Private role-based access for Admin, Legal, Compliance, KYC/AML and Management
- PDF, DOCX, TXT, CSV, JSON and Markdown ingestion, plus pasted text
- Document-specific deterministic baseline analysis
- OpenAI structured-output analysis when `OPENAI_API_KEY` is configured
- Clause evidence, issue category, severity, score and confidence
- Bank-specific explanation of why and how each risk may materialise
- Legal, regulatory, financial, operational, data/cyber and reputational impact
- Recommended mitigation and Bank-protective clause rewrite
- Missing-clause, contradiction and regulatory-touchpoint analysis
- Document-specific scenario testing
- Review assignment, escalation, acceptance-with-controls and saved decisions
- Side-by-side document risk comparison
- Active-document assistant restricted to the selected source document
- Institutional-memory and audit-trail foundation
- Downloadable JSON and text reports, plus Print / Save PDF
- Encrypted source-text storage using AES-256-GCM
- Controlled document deletion
- Login and general API rate limiting
- Automated unit, regression, API workflow and encrypted-storage tests

## Replit operation

The repository includes a `.replit` configuration for a single production process on port `3000`. The Run button performs dependency installation, builds the React client and starts the Express server. The same server serves the frontend and `/api`, avoiding the previous 5173/8080 port conflict.

Required Replit Secrets:

```text
OPENAI_API_KEY
OPENAI_MODEL
JWT_SECRET
```

Recommended additional secret:

```text
DATA_ENCRYPTION_KEY
```

Keep `JWT_SECRET` and `DATA_ENCRYPTION_KEY` stable. Changing the encryption key makes previously encrypted source text unreadable.

After the Replit workspace is synced to GitHub `main`, press **Run**. No shell command is required for ordinary operation.

## Local operation

```bash
cp .env.example .env
npm install
npm run dev
```

Split-development defaults:

- frontend: `http://localhost:5173`
- API: `http://localhost:8080`

Production / Replit uses one server and the configured `PORT`.

## Verification

```bash
npm test
npm run build
```

The automated suite verifies that:

1. the deliberately defective agreement receives materially higher risk than the corrected agreement;
2. changing a 30-business-day incident notice to a 24-hour notice changes the related finding;
3. analysis follows document content rather than the filename or title;
4. the API completes login, document analysis, comparison, assistant and deletion workflows; and
5. stored source text is encrypted rather than written as plaintext.

GitHub Actions runs tests and the production frontend build on pushes and pull requests to `main`.

## Core API flow

`POST /api/documents/analyze` accepts multipart form data:

- `file`: PDF, DOCX, TXT, CSV, JSON or MD
- `text`: optional pasted document text/context
- `title`
- `matter`
- `documentType`
- `jurisdiction`
- `riskAppetite`

The response contains the saved document metadata and structured analysis. Source text is excluded from public document responses.

## Security and institutional boundary

This repository is a working private pilot/MVP. It is not, by itself, a bank-production certification.

Before use with live bank or customer data, the deploying institution must replace the JSON data store with an approved tenant-aware database and encrypted object storage; implement enterprise identity/SSO, password hashing, granular matter permissions, secrets management, malware scanning, DLP and retention controls, immutable audit logging, backup and recovery, queue-based processing, monitoring, penetration testing, current regulatory validation and approved hosting.

LIVE SYNESIS provides decision support. Final legal, compliance, cyber, KYC/AML, risk, business and management decisions remain with authorised personnel.
