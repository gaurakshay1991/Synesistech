# LIVE SYNESIS — Self-Development Guide (Windows)

This guide lets you develop LIVE SYNESIS on your own computer without using Replit and without touching the live production database or production secrets.

## 1. What you need

### Install on Windows

1. **Git for Windows** — source-control commands and GitHub access  
   Official installer: https://git-scm.com/install/windows
2. **Node.js 22 LTS (x64)** — required by this repository  
   Official Node 22 downloads: https://nodejs.org/en/download/archive/v22  
   Do not install Node 24 or 26 for this repository until `package.json` is upgraded; the current engine requirement is `>=20 <23`.
3. **Visual Studio Code** — code editor  
   Official Windows setup: https://code.visualstudio.com/docs/setup/windows
4. **Windows Terminal** — optional but recommended; install from Microsoft Store.
5. **GitHub Desktop** — optional. Use it only if you prefer a graphical Git interface.
6. **Docker Desktop** — optional. Local development does not require Docker; it is useful only for container testing.

You do **not** need to install PostgreSQL locally. Use a separate Neon development database.

### Create accounts on these web platforms

1. **GitHub** — source repository and pull requests: https://github.com/
2. **Neon** — development Postgres database: https://console.neon.tech/
3. **OpenAI Platform** — optional live model analysis: https://platform.openai.com/
4. **Manufact** — current production deployment platform. Nothing is installed locally.
5. **Vercel** — optional alternative deployment/preview platform: https://vercel.com/

## 2. Download the source code

Open PowerShell and run:

```powershell
git clone https://github.com/gaurakshay1991/Synesistech.git
cd Synesistech
code .
```

Alternatively, open the GitHub repository, select **Code → Download ZIP**, extract it, open PowerShell in the extracted folder and run `code .`.

Verify the tools:

```powershell
node --version
npm --version
git --version
```

`node --version` should begin with `v22.`.

## 3. Install project dependencies

From the repository root:

```powershell
npm install
```

This installs the root tools and both npm workspaces:

- `client/` — React 19 + Vite frontend
- `server/` — Express API, authentication, document analysis and Neon persistence

## 4. Create the local environment file

Run:

```powershell
npm run setup:local
```

This safely creates `.env.local` from `.env.example` and does not overwrite an existing file.

Open `.env.local` in VS Code. Never commit this file. `.gitignore` already excludes it.

Use this structure:

```text
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
SYNESIS_PUBLIC_MODE=false
SYNESIS_AI_MODE=prototype
SYNESIS_API_PROXY_TARGET=http://127.0.0.1:3000

DATABASE_URL=PASTE_YOUR_NEON_DEVELOPMENT_CONNECTION_STRING
SYNESIS_ORGANIZATION_NAME=Synesis Development
SYNESIS_ORGANIZATION_SLUG=synesis-dev

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra

DATA_FILE=server/data/live-synesis-store.json
MAX_UPLOAD_MB=15

JWT_SECRET=PASTE_FIRST_RANDOM_SECRET
DATA_ENCRYPTION_KEY=PASTE_SECOND_DIFFERENT_RANDOM_SECRET

BOOTSTRAP_ADMIN_NAME=Your Name
BOOTSTRAP_ADMIN_EMAIL=your-email@example.com
BOOTSTRAP_ADMIN_PASSWORD=Use-A-Strong-Temporary-Password!123
```

### Generate the two application secrets

Run this command twice and use a different output for each variable:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

- First output → `JWT_SECRET`
- Second output → `DATA_ENCRYPTION_KEY`

Keep `DATA_ENCRYPTION_KEY` stable. Changing it later makes previously encrypted document text unreadable.

## 5. Create a Neon development database

Do not use the production Neon project for experiments.

1. Sign in to Neon.
2. Create a new project named, for example, `synesistech-development`.
3. Use the default database `neondb`.
4. Open **Connect**.
5. Select the **pooled** connection string.
6. Copy the complete PostgreSQL URL, including TLS/SSL parameters.
7. Paste it after `DATABASE_URL=` in `.env.local`.

The value will look structurally like this, but use the exact value Neon gives you:

```text
postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

Do not put quotation marks around it. Do not add spaces or line breaks.

## 6. Validate your local configuration

Run:

```powershell
npm run doctor
```

The doctor checks the supported Node version, required repository files and required environment-variable names without printing secret values.

Resolve every `ERROR` before continuing. Warnings may be acceptable, for example when you deliberately use prototype mode without an OpenAI key.

## 7. Create the database schema

Run:

```powershell
npm run db:migrate
```

This applies the idempotent schema in `server/schema.sql` and creates:

- `organizations`
- `users`
- `documents`
- `audit_events`
- `schema_migrations`
- required indexes and the `pgcrypto` extension

You normally run this once for a new development database and again after approved schema changes.

## 8. Start LIVE SYNESIS locally

Run:

```powershell
npm run dev
```

This starts two processes:

- Frontend: http://localhost:5173
- API/health server: http://localhost:3000

Open http://localhost:5173 in Chrome or Edge.

The frontend sends `/api` calls through the Vite proxy to port 3000. The repository now loads the root `.env.local` correctly and uses `SYNESIS_API_PROXY_TARGET` when you need another API port.

### First login

Use the values you entered for:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

On a completely new database, the application creates this administrator and requires a password change.

Important: bootstrap credentials create the administrator only when that email does not already exist. Changing `BOOTSTRAP_ADMIN_PASSWORD` later does not reset an existing user's password. Change it through the application or use a deliberate, reviewed reset procedure.

## 9. Choose the analysis mode

### Prototype mode — recommended while learning

```text
SYNESIS_AI_MODE=prototype
OPENAI_API_KEY=
```

This uses the deterministic analysis engine and makes no paid model calls.

### Live mode

```text
SYNESIS_AI_MODE=live
OPENAI_API_KEY=YOUR_PROJECT_API_KEY
OPENAI_MODEL=gpt-5.6-terra
```

Use a project-scoped OpenAI API key and enable API billing. A ChatGPT Plus subscription does not provide API credit. Never put the key in source code, screenshots, chat messages or GitHub.

`gpt-5.6-terra` is the practical development default. Use `gpt-5.6-sol` only when the additional capability justifies its higher cost. Luna can be used for lower-cost experiments.

After changing `.env.local`, stop the processes with `Ctrl+C` and run `npm run dev` again.

### Auto mode

```text
SYNESIS_AI_MODE=auto
```

Auto mode uses the configured API key when available and retains the deterministic prototype path when live analysis cannot be used. The UI and database provenance identify which engine produced each result.

## 10. Understand the codebase

### Frontend

- `client/src/App.jsx` — authenticated application, navigation, dashboard, upload, review, comparison, reports and admin UI
- `client/src/styles.css` — visual system, layout, responsive behaviour and component styling
- `client/src/main.jsx` — React entry point
- `client/vite.config.js` — local frontend server, production build and `/api` proxy

### Backend

- `server/src/index.js` — long-running server entry point, `/health` and MCP mounting
- `server/src/app.js` — Express application, login, sessions, users, uploads, analysis, decisions, audit and reports
- `server/src/config.js` — environment loading and production configuration validation
- `server/src/storage.js` — Neon and local storage operations
- `server/src/analysis-engine.js` — document-specific deterministic and live multipass analysis orchestration
- `server/src/file-parser.js` — PDF, DOCX and text extraction plus file validation
- `server/src/encryption.js` — protected source-text storage
- `server/src/mcp.js` — Model Context Protocol endpoint
- `server/src/analysis-provenance.js` — database provenance rules for prototype and live analysis
- `server/schema.sql` — canonical database schema
- `server/scripts/migrate.js` — schema migration runner
- `server/test/` — regression and upload-safety tests

### Deployment

- `api/index.js` — Vercel serverless Express entry point
- `Dockerfile` — container build used by Manufact
- `vercel.json` — Vercel build and route configuration
- `.circleci/config.yml` — CI checks when CircleCI is connected

## 11. Safe development workflow

Never code directly on `main`.

Before starting work:

```powershell
git switch main
git pull origin main
git switch -c feature/describe-your-change
```

Make one focused change. Then run:

```powershell
npm run doctor
npm run check
```

`npm run check` runs server regression tests, runtime syntax validation and a production frontend build.

Review your changes:

```powershell
git status
git diff
```

Commit and push:

```powershell
git add .
git commit -m "Describe the completed change"
git push -u origin feature/describe-your-change
```

Open a pull request on GitHub from your feature branch to `main`. Merge only after checks pass and you have reviewed the diff.

## 12. How to make common changes

### Change the interface

Edit:

- `client/src/App.jsx`
- `client/src/styles.css`

Keep repeated UI in reusable components instead of copying markup. Test desktop and mobile widths.

### Add an API route

Add the route and validation in `server/src/app.js`. Reuse authentication, role checks, audit logging and tenant scoping. Do not return encrypted or raw source text unnecessarily.

### Change document analysis

Edit `server/src/analysis-engine.js` and add a regression test under `server/test/`. Test the same document before and after the change; do not accept generic title-based output.

### Change the database

Do not edit the production database manually.

1. Update `server/schema.sql` idempotently.
2. Test against a separate Neon development branch/project.
3. Add a migration identifier to `schema_migrations` when required.
4. Run `npm run db:migrate` on development.
5. Verify existing documents and users still work.
6. Merge through a reviewed pull request.
7. Apply to production only after a backup/restore point exists.

### Add a dependency

Frontend dependency:

```powershell
npm install PACKAGE_NAME --workspace client
```

Backend dependency:

```powershell
npm install PACKAGE_NAME --workspace server
```

Then commit both `package.json` and `package-lock.json`.

## 13. Deploy to Manufact

Manufact is a web platform; nothing is installed on your PC.

1. Push and merge tested code to GitHub `main`.
2. Open Manufact → **Servers → Synesistech**.
3. Confirm the GitHub repository is `gaurakshay1991/Synesistech` and the production branch is `main`.
4. Add production values in **Environment Variables / Secrets**. Never upload `.env.local`.
5. Confirm application port `3000` and health path `/health`.
6. Redeploy.
7. Verify build tests, health, runtime logs, MCP endpoint and login.

For a separate deployment, use a separate Manufact server and separate Neon database. Do not point experimental deployments at production data.

## 14. Deploy to Vercel instead

1. Import the GitHub repository into Vercel.
2. Keep the repository root as the project root.
3. Add the required environment variables in Vercel project settings.
4. Deploy. `vercel.json` controls the Vite build, SPA routing and API functions.
5. Verify `/api/health`, authentication, upload, analysis and database persistence.

Manufact is preferable for the current unified long-running Express + MCP server. Vercel is useful for previews and serverless testing.

## 15. Troubleshooting

### Frontend opens but API requests fail

- Confirm `npm run dev` shows both Vite and Express processes.
- Confirm http://localhost:3000/health opens.
- Confirm `.env.local` contains `SYNESIS_API_PROXY_TARGET=http://127.0.0.1:3000`.
- Restart the dev command after environment changes.

### Port already in use

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

Stop the conflicting process or change `PORT` and `SYNESIS_API_PROXY_TARGET` together.

### Database migration fails

- Copy the pooled Neon connection string again.
- Remove spaces, quotes and line breaks.
- Confirm the Neon project and compute are active.
- Confirm the URL includes the correct database and TLS setting.

### Login fails

- Confirm the bootstrap email exactly matches `.env.local`.
- On an existing database, use the password currently stored for that user; changing the bootstrap variable does not reset it.
- Check server logs for inactive-account or password-change messages.

### OpenAI returns 429 quota errors

- Confirm API billing is active and the project has usable credit/limits.
- Use `SYNESIS_AI_MODE=prototype` while developing without paid API access.
- Restart the server after changing the mode.

### Old documents cannot be decrypted

The `DATA_ENCRYPTION_KEY` changed. Restore the original key used to encrypt those records. There is no safe automatic recovery without that key.

## 16. Security rules

- Never commit `.env`, `.env.local`, API keys, passwords, database URLs or encryption keys.
- Use separate development and production databases.
- Use separate development and production OpenAI keys.
- Do not use real confidential institutional documents in an experimental environment.
- Keep `JWT_SECRET` and `DATA_ENCRYPTION_KEY` different and stable.
- Review `git diff --staged` before every commit.
- Rotate any secret immediately if it appears in Git history, logs, screenshots or chat.
- Before real institutional use, complete privacy, information-security, model-risk, vendor-risk, backup, retention, monitoring and penetration-testing reviews.

## 17. Minimum learning order

Learn in this order while making small changes to Synesis:

1. Git and GitHub: clone, branch, diff, commit, push and pull request
2. JavaScript fundamentals: variables, functions, arrays, objects, promises and modules
3. React: components, props, state, effects and forms
4. CSS: layout, responsive design and accessibility
5. Express: routes, middleware, authentication and error handling
6. SQL/Postgres: tables, indexes, JSONB, queries and migrations
7. API security: cookies, JWT, password hashing, CORS, rate limits and secret management
8. Automated tests and deployment logs

Do not attempt a large redesign first. Start with one label, one field, one report section or one tested analysis rule; complete the branch-and-PR cycle each time.
