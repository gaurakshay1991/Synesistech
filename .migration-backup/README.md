# LIVE SYNESIS

LIVE SYNESIS is a document-led legal and compliance operating platform designed initially for banks and other regulated financial institutions.

The uploaded document is the source of truth. The platform extracts the actual file, identifies clauses and sections, detects risks, gaps, contradictions and missing protections, explains why each issue is risky for the Bank, assigns a High/Medium/Low risk and score, recommends mitigation, rewrites clauses, creates document-specific scenarios and produces a decision-ready report.

## What is included in this MVP

- Private role-based login for Admin, Legal, Compliance, KYC/AML and Management
- Upload and extraction for PDF, DOCX, TXT, CSV, JSON and Markdown
- Pasted-text analysis when no file is available
- Local deterministic baseline engine that responds to the uploaded text
- OpenAI structured-output analysis when `OPENAI_API_KEY` is configured
- Clause-level evidence, issue, risk category, level and score
- Bank-specific explanation of why and how the risk may materialise
- Legal, regulatory, financial, operational, data/cyber and reputational impact
- Recommended mitigation and Bank-protective clause rewrite
- Missing-clause and contradiction detection
- Document-specific scenario testing
- Regulatory, cyber and KYC/AML touchpoint mapping
- Decision workflow and institutional-memory view
- Downloadable text and JSON reports
- Audit trail
- Automated comparison tests using defective and corrected vendor agreements

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:8080`

Add the API key you created to the private `.env` file as `OPENAI_API_KEY`. Never commit the real key.

## Test

```bash
npm test
```

The tests verify that:

1. the deliberately defective agreement receives materially higher risk than the corrected agreement;
2. replacing a 30-business-day incident notice with a 24-hour notice changes the related risk result; and
3. analysis follows document content rather than the filename or title.

## Core API flow

`POST /api/documents/analyze` accepts multipart form data:

- `file`: PDF, DOCX, TXT, CSV, JSON or MD
- `text`: optional pasted text/context
- `title`
- `matter`
- `documentType`
- `jurisdiction`
- `riskAppetite`

The response contains the saved document and structured analysis.

## Important MVP limits

This branch is a working private MVP, not a bank-production deployment. Before institutional use, replace the JSON store with an approved database; use encrypted object storage; add enterprise identity/SSO, password hashing, granular tenant and matter permissions, secrets management, malware scanning, DLP, retention controls, immutable audit logging, queue-based processing, observability, penetration testing, legal/regulatory validation and approved hosting.

The platform provides decision support. Final legal, compliance, cyber, KYC/AML, risk and management approval remains with authorised Bank personnel.
