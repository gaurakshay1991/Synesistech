# SYNESIS NEW MODEL 3.0

SYNESIS NEW MODEL 3.0 is a regulatory decision assurance and execution platform for banks and other regulated institutions.

It converts source evidence into obligations, institutional impact, accountable decisions, governed actions, verified completion evidence and reusable decision memory.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The React client runs on port 5173 and proxies `/api` to the Node server on port 3000.

## Validate

```bash
npm run check
```

This runs server regression tests and the production frontend build.

## Production

The repository root contains `render.yaml`. Render deploys this directory as one Node web service and provisions PostgreSQL through `DATABASE_URL`.

Required deployment secrets:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `OPENAI_API_KEY`

Render generates `JWT_SECRET` and `DATA_ENCRYPTION_KEY`.

The free Render profile is for pilot use only. Regulated production use requires durable paid PostgreSQL, backups, recovery testing, SSO/MFA, tenant isolation, penetration testing, model-risk controls, data-residency approval and vendor-risk approval.

## Operating boundary

Synesis provides governed institutional decision support. It does not autonomously execute high-risk legal, regulatory, customer, capital or operational actions. Those actions require authorised human approval gates.
