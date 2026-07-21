# SYNESIS NEW MODEL 3.0 — Render and CircleCI

## Architecture

- GitHub branch: `synesis-new-model-3.0-render`
- Runtime: Render Node web service
- Data: Render PostgreSQL through `DATABASE_URL`
- Validation: CircleCI installs locked dependencies, runs server regression tests, and builds the production React frontend
- Promotion: CircleCI can invoke a Render deploy hook only after validation succeeds

## Render pilot

The root `render.yaml` creates:

1. A free Node web service.
2. A free Render PostgreSQL database.
3. Generated JWT and encryption secrets.
4. Secret placeholders for the bootstrap administrator and OpenAI API key.
5. A `/api/health` deployment health check.

Before applying the Blueprint, provide:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters)
- `OPENAI_API_KEY`

The free PostgreSQL instance is suitable only for a time-limited pilot and currently expires after 30 days. Do not place regulated production data in the free pilot.

## Production profile

`render.production.yaml.example` uses:

- a paid Starter web service;
- a paid `basic-256mb` PostgreSQL instance;
- the complete test and frontend build as the Render build gate.

Rename it to `render.yaml` on the production branch only after security, data-residency, backup, penetration-testing, model-risk and vendor-risk approval.

## CircleCI

Connect this GitHub repository to CircleCI. Add the following project environment variable only after Render creates the service:

- `RENDER_DEPLOY_HOOK_URL`

The pipeline will:

1. Restore the deterministic npm cache.
2. Run `npm ci`.
3. Run `npm test`.
4. Run `npm run build`.
5. Store `client/dist` as a build artifact.
6. Trigger Render only for the `synesis-new-model-3.0-render` branch and only after the build succeeds.

## Product implementation standard

Build Web Apps is used as the frontend engineering standard rather than as a hosting platform. The frontend must remain task-first, responsive and fully interactive. Build completion requires browser verification of:

- Command Centre navigation;
- live document upload and analysis;
- regulatory-change workflow;
- institutional simulations;
- role-controlled decisions and approvals;
- desktop and mobile layouts;
- absence of console errors, blank screens, dead controls and overflow.

## Required production controls

Before institutional use:

- SSO/SAML/OIDC and MFA;
- SCIM lifecycle management;
- tenant isolation and information barriers;
- immutable audit export;
- retention, deletion and legal hold;
- database backups and tested recovery;
- observability and alerting;
- model evaluation and prompt/version governance;
- vulnerability scanning and penetration testing;
- India data-residency and regulatory approval where applicable.
