# SYNESIS ENTERPRISE PLATFORM - COMPLETE GUIDE

**Version:** 3.0.0  
**Status:** Production-Ready  
**Last Updated:** July 2026

---

## Executive Summary

**SYNESIS** is an AI-native **Institutional Decision Intelligence and Execution Platform** for regulated and capital-intensive organizations. It transforms fragmented documents, obligations, entities, controls, and institutional data into **explainable decisions** and **governed actions**.

### Platform Capabilities

- **Document Intake & Analysis**: Secure ingestion of PDF, DOCX, TXT, CSV, JSON, Markdown, XML with multi-pass AI reasoning
- **Institutional Intelligence**: Convert documents into obligations, triggers, approval gates, and decision questions
- **Regulatory Command**: Change monitoring, impact mapping, control mapping, evidence tracking
- **Decision Assurance**: Multi-level review, challenge passes, provenance tracking, audit trails
- **Enterprise Execution**: Task workflows, approval gates, evidence management, role-based access control
- **Institutional Twin**: Real-time governance state, metrics, decision memory, scenario modeling
- **AI Control Tower**: Model management, prompt governance, cost tracking, security controls

---

## Technology Stack

### Core Technologies
```
Frontend:       React 19 + Vite 6 + Lucide Icons
Backend:        Express.js + Node.js (ES modules)
Database:       PostgreSQL (Neon serverless for cloud)
AI Integration: OpenAI API (GPT-5-mini or configurable)
Security:       bcryptjs, JWT, AES-256-GCM encryption
Deployment:     Vercel, Render, or Single-process (Replit)
```

### Key Dependencies
- **@neondatabase/serverless** - Serverless PostgreSQL connectivity
- **@vercel/oidc** - OIDC authentication for Vercel
- **express-rate-limit** - API rate limiting and DDoS protection
- **helmet** - Security headers
- **mammoth** - DOCX parsing
- **pdf-parse** - PDF extraction
- **zod** - Runtime schema validation
- **openai** - Official OpenAI SDK with structured outputs

---

## Architecture Overview

### Solution Components

```
┌─────────────────────────────────────────────────────────────┐
│                  SYNESIS ENTERPRISE PLATFORM                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SYNESIS DECISION CORE                                   │
│     ├─ Document intake & ingestion                          │
│     ├─ Institutional graph & entity mapping                 │
│     ├─ Workflow orchestration & approvals                   │
│     ├─ Evidence & completion tracking                       │
│     ├─ Search & collaboration                               │
│     └─ Decision Memory (reusable patterns)                  │
│                                                              │
│  2. CONTROL COMMAND MODULES                                 │
│     ├─ Contract Command: Review, negotiation, playbooks     │
│     ├─ Regulatory Command: Change monitoring, evidence      │
│     ├─ Governance & Authority: Entities, signatories        │
│     └─ Capital Intelligence: Mandate limits, conflicts      │
│                                                              │
│  3. INSTITUTIONAL INTELLIGENCE LAYER                        │
│     ├─ Institutional Twin: Real-time state modeling         │
│     ├─ Decision Q&A: Matter-scoped questioning              │
│     ├─ Scenario Analysis: Stress testing & simulations      │
│     └─ Assurance Packs: Downloadable reports & KPIs         │
│                                                              │
│  4. AI CONTROL TOWER                                        │
│     ├─ Model management & versioning                        │
│     ├─ Prompt governance & A/B testing                      │
│     ├─ Cost & performance monitoring                        │
│     ├─ Data residency & retention controls                  │
│     └─ Security audit & penetration testing                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

           ENTERPRISE AUTHENTICATION & AUTHORIZATION
        (SSO/SAML, MFA, Role-Based Access Control, Audit Logs)

           TENANT-SCOPED DATA ENCRYPTION & ISOLATION
        (AES-256-GCM, Encryption at Rest, Encrypted in Transit)
```

### Data Flow

```
1. INGESTION LAYER
   ├─ Document Upload (PDF, DOCX, TXT, CSV, JSON, XML, Markdown)
   ├─ Binary Content Rejection & File Signature Validation
   ├─ SHA-256 Content Fingerprinting
   └─ Text Extraction (with language detection & encoding normalization)

2. ANALYSIS LAYER
   ├─ Primary Reasoning Pass
   │  ├─ Clause-level issue identification
   │  ├─ Evidence linking & materiality assessment
   │  ├─ Institutional impact analysis
   │  └─ Stakeholder mapping
   │
   ├─ Decision Intelligence Pass
   │  ├─ Obligation extraction & classification
   │  ├─ Trigger identification & dependencies
   │  ├─ Approval gate mapping
   │  ├─ Action sequencing & deadline calculation
   │  └─ Evidence requirement specification
   │
   └─ Independent Challenge Pass (Deep Mode)
      ├─ Cross-clause interaction testing
      ├─ False positive detection
      ├─ Omission identification
      ├─ Commercial proportionality assessment
      └─ Regulatory defensibility review

3. RECONCILIATION & DEDUPLICATION
   ├─ Finding consolidation
   ├─ Confidence scoring
   ├─ Risk level aggregation
   └─ Overall risk positioning

4. VERIFICATION (Optional)
   ├─ Current legal/regulatory proposition checking
   ├─ Authoritative source cross-reference
   └─ Model-risk compliance scoring

5. PERSISTENCE LAYER
   ├─ Encrypted text storage (AES-256-GCM)
   ├─ Analysis JSON (searchable, GIN-indexed)
   ├─ Audit trail logging
   ├─ Decision workflow tracking
   └─ Evidence chain of custody

6. DECISION EXECUTION
   ├─ Role-gated approval workflow
   ├─ Provenance tracking (AI or fallback)
   ├─ Status transitions & governance
   ├─ Action verification
   └─ Completion evidence collection
```

---

## Database Schema

### Core Tables

#### Organizations
```sql
- id (uuid, PK)
- name (text)
- slug (text, unique)
- created_at, updated_at (timestamptz)
```

#### Users
```sql
- id (uuid, PK)
- organization_id (uuid, FK)
- name, email (text)
- role (enum: admin, legal, compliance, kyc, management, risk, business)
- password_hash, is_active, must_change_password
- last_login_at, created_at, updated_at
```

#### Documents
```sql
- id (uuid, PK)
- organization_id (uuid, FK)
- title, matter, jurisdiction, document_type
- original_file_name, mime_type, size_bytes
- parser (pdf-parse, mammoth, text)
- content_sha256 (file integrity)
- encrypted_text (jsonb) - encrypted source text
- analysis (jsonb) - findings, obligations, decisions
- decisions (jsonb[]) - approval history & status
- status (AI Review Complete, In Legal Review, Approved, etc.)
- uploaded_by (uuid, FK), uploaded_by_email
- created_at, updated_at, deleted_at (soft delete)

INDEXES:
- (organization_id, updated_at DESC) WHERE deleted_at IS NULL
- (organization_id, status) WHERE deleted_at IS NULL
- GIN on analysis (for full-text search)
```

#### Audit Events
```sql
- id (bigint, auto-increment PK)
- organization_id, user_id (FKs)
- user_email, role, action
- entity_type, entity_id, metadata (jsonb)
- request_id, ip_address
- created_at (timestamptz)

INDEX: (organization_id, created_at DESC)
```

---

## API Reference

### Authentication

#### POST `/api/auth/login`
Login with email and password.
```json
{
  "email": "user@org.com",
  "password": "SecurePassword123!"
}
```
**Response:** User object + HttpOnly session cookie

#### GET `/api/auth/session`
Verify current session. Returns null if not authenticated.

#### POST `/api/auth/logout`
Clear session cookie and invalidate session.

#### POST `/api/auth/change-password`
Change temporary password on first login.
```json
{
  "currentPassword": "TemporaryPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

### Document Management

#### POST `/api/documents/analyze`
Analyze a document with optional AI reasoning.
```
Content-Type: multipart/form-data
- file: (PDF, DOCX, TXT, CSV, JSON, XML, Markdown)
- title: "Contract Title"
- matter: "Matter Description"
- jurisdiction: "England & Wales"
- documentType: "Service Agreement"
- riskAppetite: "Conservative"
- analysisMode: "deep" (quick, standard, deep)
- useCurrentSources: false
```

**Response:**
```json
{
  "document": {
    "id": "uuid",
    "title": "...",
    "analysis": {
      "engine": "Synesis live multipass (gpt-5-mini)",
      "overall_risk": "High",
      "overall_score": 72,
      "findings": [
        {
          "risk_level": "High",
          "confidence": 85,
          "issue": "Unlimited liability exposure",
          "clause_reference": "Section 3.2",
          "quoted_text": "...",
          "institutional_impact": "...",
          "recommended_mitigation": "..."
        }
      ],
      "obligations": [...],
      "decision_questions": [...]
    }
  },
  "state": { ... }
}
```

#### GET `/api/documents`
List documents for the organization.
```
?limit=100
```

#### GET `/api/documents/:id`
Get full document with encrypted text (authorized users only).

#### POST `/api/documents/:id/ask`
Ask document-specific questions.
```json
{
  "question": "What are the termination rights?"
}
```

#### PATCH `/api/documents/:id/status`
Update document review status.
```json
{
  "status": "Approved by Legal"
}
```

### Institutional State Management

#### GET `/api/bootstrap`
Get full institutional state on app load.
```json
{
  "user": { ... },
  "state": {
    "obligations": [ ... ],
    "tasks": [ ... ],
    "decisions": [ ... ],
    "controls": [ ... ],
    "evidence": [ ... ],
    "simulations": [ ... ],
    "metrics": {
      "attention": 5,
      "critical": 2,
      "decisionsPending": 3,
      "evidenceCoverage": 78
    },
    "graph": {
      "nodes": [ ... ],
      "edges": [ ... ]
    }
  },
  "documents": [ ... ]
}
```

#### POST `/api/ask`
Ask institutional-level questions.
```json
{
  "question": "What are our critical obligations?"
}
```

### Decision Management

#### PATCH `/api/decisions/:id`
Approve or challenge a decision.
```json
{
  "status": "Approved",
  "approvalNote": "Reviewed and within risk appetite"
}
```

### Task & Evidence Management

#### PATCH `/api/tasks/:id`
Update task status.
```json
{
  "status": "In Progress",
  "owner": "Jane Smith"
}
```

#### POST `/api/evidence`
Create evidence record.
```json
{
  "title": "Board Approval Minutes",
  "entity": "Capital Committee"
}
```

#### PATCH `/api/evidence/:id`
Mark evidence as verified.
```json
{
  "status": "Verified",
  "note": "Confirmed by audit 2026-07-21"
}
```

### Regulatory & Scenario Management

#### POST `/api/regulatory-change`
Log a regulatory change impact.
```json
{
  "title": "FCA Updates AML Reporting Rules",
  "jurisdiction": "UK",
  "effectiveDate": "2026-09-01",
  "impact": "Changes transaction monitoring thresholds"
}
```

#### POST `/api/simulations`
Create a scenario simulation.
```json
{
  "name": "Market Disruption Scenario",
  "probability": 30,
  "impact": 8
}
```

#### POST `/api/simulations/:id/response-plan`
Build response plan for a simulation.

### Reporting

#### GET `/api/reports/assurance-pack`
Generate downloadable PDF assurance pack with executive summary, findings, approvals, evidence, and KPIs.

### Administration

#### GET `/api/admin/users`
List organization users (admin only).

#### POST `/api/admin/users`
Create new user (admin only).
```json
{
  "name": "John Compliance",
  "email": "john@org.com",
  "role": "compliance",
  "temporaryPassword": "TemporaryPass123!"
}
```

#### PATCH `/api/admin/users/:id`
Activate/deactivate user (admin only).

#### GET `/api/admin/audit`
List audit events (admin/audit roles only).
```
?limit=500
```

---

## Role-Based Access Control

| Role | Capabilities |
|------|---|
| **admin** | All operations, user management, audit logs, deployment config |
| **legal** | Document intake & review, approval gates, evidence marking, contract analysis |
| **compliance** | Regulatory tracking, control mapping, approval decisions, evidence verification |
| **kyc** | KYC/AML analysis, evidence collection, risk assessment |
| **risk** | Risk analysis, decision review, scenario modeling, control effectiveness |
| **business** | Document intake, task tracking, execution, completion evidence |
| **management** | Dashboard access, approval authority, reporting, escalations |

---

## Security Architecture

### Authentication & Authorization
- **Session Management**: HttpOnly cookies, 8-hour expiry
- **Password Requirements**: Minimum 12 characters, uppercase, lowercase, digits, special chars
- **First-Login**: Mandatory temporary password replacement
- **Rate Limiting**: 300 requests/minute globally, 12 login attempts per 15 minutes
- **JWT Tokens**: Signed with HS256, includes user role and organization context

### Data Protection
- **Encryption at Rest**: AES-256-GCM for sensitive fields
- **Encryption in Transit**: HTTPS (TLS 1.3)
- **Encryption Keys**: Independent stable random secrets (32+ chars)
- **Audit Trail**: Immutable logging of all operations, user email, role, IP address
- **Soft Deletes**: Documents marked deleted_at, not physically removed

### CORS & Headers
- **helmet.js**: Security headers (CSP, X-Frame-Options, HSTS)
- **CORS**: Credentials-based, same-origin policy
- **Request Validation**: Zod schemas with strict type checking
- **Rate Limiting**: Express-rate-limit with sliding window

### File Upload Security
- **File Signature Validation**: PDF magic bytes (0x25504446), DOCX ZIP structure (0x504B)
- **Binary Content Rejection**: Statistical analysis of byte distribution
- **File Size Limits**: Configurable max (default 15MB)
- **Supported Types Only**: PDF, DOCX, TXT, CSV, JSON, XML, Markdown
- **In-Memory Processing**: No temporary files written to disk
- **SHA-256 Hashing**: Content fingerprint for integrity verification

---

## Deployment Guide

### Local Development

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or use Neon serverless)
- OpenAI API key (optional for fallback mode)

#### Setup
```bash
# Clone repository
git clone https://github.com/gaurakshay1991/Synesistech.git
cd Synesistech

# Copy environment template
cp .env.example .env

# Edit .env with your values:
# - DATABASE_URL (PostgreSQL connection string)
# - JWT_SECRET (min 32 chars, random)
# - DATA_ENCRYPTION_KEY (min 32 chars, random, different from JWT_SECRET)
# - OPENAI_API_KEY (optional)
# - BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Proxy: `/api` → `http://localhost:3000/api`

#### Development Commands
```bash
npm run dev          # Start both client and server
npm run build        # Build production client
npm run test         # Run server regression tests
npm run check        # Build + test (pre-deployment check)
```

### Docker / Containerized Deployment

```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy monorepo
COPY package*.json ./
COPY client ./client
COPY server ./server
COPY model3 ./model3

# Install
RUN npm install

# Build client
RUN npm run build

# Set production env
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

### Vercel Deployment

#### Configuration (`vercel.json`)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.js" },
    { "src": "/(.*)", "dest": "client/dist/index.html" }
  ]
}
```

#### Setup Steps
1. Connect GitHub repo to Vercel project
2. Add environment variables in Vercel dashboard:
   - `DATABASE_URL` (Neon serverless connection string with pooling)
   - `JWT_SECRET` (32+ chars, stable)
   - `DATA_ENCRYPTION_KEY` (32+ chars, stable, different from JWT)
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (gpt-5-mini or gpt-4o)
3. Deploy: `git push` or click "Deploy" in Vercel dashboard
4. Vercel runs `npm run build` and starts `api/index.js`

### Render Deployment

#### Setup Steps
1. Create Render Web Service from GitHub
2. Build command: `npm run build`
3. Start command: `npm start`
4. Add environment variables (Render Secrets)
5. Provision PostgreSQL database (Render managed)

#### Render YAML Configuration
```yaml
services:
  - type: web
    name: synesis-platform
    runtime: node
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: synesis-db
          property: connectionString
```

### Single-Process Deployment (Replit)

```bash
# .replit configuration
run = "npm run replit"
```

The included `.replit` file:
1. Installs dependencies
2. Builds the React client
3. Runs Express server on port 3000
4. Serves static client from `client/dist`
5. Routes `/api/*` to Express handlers

**Environment Setup in Replit:**
- Add secrets in Replit Secrets sidebar
- Keep same variable names as `.env.example`

---

## Operations & Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "ok": true,
  "product": "SYNESIS NEW MODEL 3.0",
  "version": "3.0.0",
  "ai": "live-multipass-configured",
  "storage": "neon-postgres",
  "time": "2026-07-21T12:15:04Z"
}
```

### Logging
- **Console Logs**: Application startup, port, AI configuration status
- **Audit Trail**: All user actions logged to `audit_events` table
- **Error Tracking**: Stack traces in console; error details in response headers (`x-request-id`)

### Performance Monitoring
- **Response Times**: Monitor API endpoints for latency trends
- **AI Cost Tracking**: Log token usage per analysis (OpenAI API)
- **Database Performance**: Monitor slow queries on `documents` table (GIN index on analysis)
- **Upload Performance**: Average file parsing time per format

### Backup Strategy
- **PostgreSQL Backups**: Enable automated backups in Neon or managed database
- **Point-in-Time Recovery**: Test recovery procedures quarterly
- **Encryption Key Backup**: Secure offline backup of `DATA_ENCRYPTION_KEY` (cannot re-derive encrypted text without it)
- **Audit Trail Export**: Regular export of `audit_events` for compliance

---

## Troubleshooting

### Common Issues

#### 1. "OPENAI_API_KEY is not configured"
- **Solution**: Set `OPENAI_API_KEY` and `OPENAI_MODEL` in environment
- **Fallback**: Platform will operate in deterministic fallback mode (limited analysis)

#### 2. "Database connection failed"
- **Check**: PostgreSQL is running and `DATABASE_URL` is correct
- **Format**: `postgresql://user:password@host:port/dbname`
- **Neon**: Use pooled connection string for serverless

#### 3. "File upload rejected: Binary content"
- **Cause**: File is corrupted or not actually a PDF/DOCX
- **Solution**: Re-save file in native application, then upload

#### 4. "Session expired or invalid"
- **Cause**: JWT token expired (8-hour window) or signed with different secret
- **Solution**: Re-login; check JWT_SECRET consistency across deployments

#### 5. "Encryption key mismatch"
- **Cause**: `DATA_ENCRYPTION_KEY` changed, but encrypted data remains
- **Solution**: Restore previous key from backup (cannot decrypt without original key)

---

## Compliance & Governance

### Data Residency
- Deploy to specific cloud region matching regulatory requirements
- Use Neon regions: US East, US West, EU Central, EU West

### Penetration Testing
- Conduct before processing real institutional data
- Check: Authentication bypass, SQL injection, XSS, CSRF, file upload exploits

### Privacy & Retention
- Implement data retention policies (documents deleted_at timestamp)
- GDPR: Support data subject access requests via audit trail
- CCPA: Document personal data processing in privacy policy

### Model Risk Management
- Document model inputs, outputs, assumptions, limitations
- Implement model versioning (track OPENAI_MODEL in analysis_details)
- Independent testing of AI-generated decisions vs. deterministic fallback
- Escalation procedures for edge cases and false positives

### Audit Requirements
- Immutable audit trail (append-only audit_events table)
- User accountability (all actions linked to user email + IP)
- Change tracking (document status transitions logged)
- Decision provenance (AI model + pass count recorded)

---

## Performance Optimization

### Database Tuning
```sql
-- Optimize analysis GIN index
VACUUM ANALYZE documents;
REINDEX INDEX documents_analysis_gin_idx;

-- Monitor slow queries
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

### API Optimization
- **Connection Pooling**: Use Neon connection pooler for serverless
- **Query Optimization**: Paginate large document lists (limit 100-300)
- **Cache**: Implement Redis for frequently accessed institutional state (optional)
- **Compression**: Enable gzip on Express responses

### Frontend Optimization
- **Code Splitting**: Lazy-load screens (already configured in Vite)
- **Bundle Size**: ~250KB gzipped (React 19 + Vite bundle)
- **Image Optimization**: Use lucide-react SVG icons (no image files)

---

## Development Roadmap

### Phase 2: Advanced Features
- [ ] Contract negotiation playbooks & auto-redlining
- [ ] Multi-user real-time collaboration with Yjs/WebSocket
- [ ] Document version control & change tracking
- [ ] Custom decision templates & automation rules
- [ ] Integration with external legal databases
- [ ] Mobile-responsive native app

### Phase 3: Enterprise Scale
- [ ] Multi-tenancy isolation improvements
- [ ] Advanced audit trail querying
- [ ] Machine learning for obligation pattern recognition
- [ ] Integration with ERPs, CLMs, case management systems
- [ ] API client libraries (Python, JavaScript, Go)
- [ ] White-label deployment option

### Phase 4: Ecosystem
- [ ] Partner marketplace for domain-specific agents
- [ ] Industry-specific solution packs (Banking, Insurance, Asset Management)
- [ ] Regulatory intelligence feeds
- [ ] Legal AI training models (fine-tuned on customer data)

---

## Support & Resources

### Documentation
- [README.md](./README.md) - Quick start
- [API Reference](#api-reference) - Endpoint documentation
- [Database Schema](#database-schema) - Data model
- This guide - Complete enterprise documentation

### Testing
```bash
# Run regression test suite
npm run test

# Verify production build
npm run check
```

### Support Contacts
- **GitHub Issues**: https://github.com/gaurakshay1991/Synesistech/issues
- **Email**: admin@synesis.local (configured in bootstrap)

---

## License & Legal

**Synesis Platform** is proprietary software by Gaurakshay1991.

**Important Disclaimer:**
- Synesis provides **governed decision support only**, not autonomous execution
- High-risk legal, regulatory, capital, or operational actions require **authorized human review**
- Organizations must complete their own:
  - Privacy & security assessments
  - Model-risk compliance testing
  - Penetration testing
  - Regulatory approval
  - Data residency verification
  - Backup & recovery procedures

**See** [Operating Boundary](#operating-boundary) section in main README.

---

## Appendix: Advanced Configuration

### Custom AI Models
Edit `OPENAI_MODEL` in environment:
```bash
# Official OpenAI models
OPENAI_MODEL=gpt-5-mini              # Recommended for cost/speed
OPENAI_MODEL=gpt-4o                  # For complex reasoning
OPENAI_MODEL=gpt-4-turbo             # Legacy model

# Or use Azure OpenAI with custom endpoint
OPENAI_API_KEY=azure-...
OPENAI_BASE_URL=https://...openai.azure.com/
```

### Custom Database
Override default Neon:
```bash
# PostgreSQL on AWS RDS
DATABASE_URL=postgresql://user:pass@rds-instance.c0abcdef.us-east-1.rds.amazonaws.com:5432/synesis

# Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/synesis_db
```

### Rate Limiting Tuning
Edit `model3/server/src/index.js`:
```javascript
app.use(rateLimit({
  windowMs: 60000,      // 1 minute window
  max: 300,             // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false
}));
```

### File Upload Limits
```javascript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,  // 15MB max
    files: 1,                     // 1 file per upload
    fields: 20                    // Max 20 form fields
  }
});
```

---

## Changelog

### v3.0.0 (Current - July 2026)
- ✅ Multi-pass AI analysis (primary, decision, challenge)
- ✅ Document intake with signature validation
- ✅ PostgreSQL tenant-scoped persistence
- ✅ Role-based access control (7 roles)
- ✅ Institutional state management & graph
- ✅ Audit trail & provenance tracking
- ✅ Regulatory change monitoring
- ✅ Scenario simulations
- ✅ Decision approval workflows
- ✅ Evidence & completion tracking
- ✅ Vercel, Render, Replit deployment
- ✅ React 19 + Vite frontend
- ✅ Emergency deterministic fallback mode

### v3.1.0 (Planned Q4 2026)
- Real-time collaboration
- Advanced search & NLP
- Custom playbook builder
- External integration APIs

---

**Questions?** Open an issue or contact the team.

*Last updated: July 21, 2026*
