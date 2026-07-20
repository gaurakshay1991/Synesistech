# Synesis Institutional OS — Standalone Release

This branch is an isolated product line created from the validated LIVE SYNESIS foundation. It is intentionally not merged into the existing Synesistech `main` branch.

## Source identity

- Release branch: `standalone/synesis-institutional-os`
- Package: `synesis-institutional-os`
- Product mode: private institutional decision-and-execution operating system

## Included workspaces

1. Institutional Command — impact, decisions, accountable actions, approval gates, evidence and controlled closure.
2. Regulatory Command — regulatory change, obligations, controls, remediation and closure.
3. Decision OS — document, legal, compliance and obligation intelligence.
4. Capital & Scenario Lab — portfolios, mandates, regulation and cross-functional simulations.

## Dedicated data infrastructure

- Neon project: `synesis-institutional-os`
- Neon project ID: `misty-thunder-28330298`
- Production branch: `main`
- Development branch: `development`
- Database: `neondb`
- Organisation slug: `synesis-institutional-os`

No database credentials are stored in this repository. Configure `DATABASE_URL` only through the deployment secret manager.

## Enterprise controls

- Organisation-scoped data model.
- Encrypted document source text.
- Institutional events, objects and relationships.
- Obligations, decisions, actions and evidence records.
- Audit trail.
- Human approval for high-risk actions.
- Matter closure blocked until decisions and actions are resolved and completion evidence exists.

## Deployment boundary

Deploy this branch as a new private Vercel project. Do not attach it to the existing Synesistech production project. Configure a new project-specific environment using `.env.example` and the dedicated Neon connection string.
