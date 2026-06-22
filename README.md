# Synesis Private Investor Platform

Synesis is a private LegalTech web platform for live legal research, contract review, clause rewriting, legal memo generation and regulatory watch.

This repository is private and intended only for Akshay and selected investors. There is no payment module and no public self-signup.

## Features

- Private login for admin, investor and reviewer roles
- Live legal research through backend AI integration
- Contract review from pasted agreement text
- Clause rewrite by negotiation stance
- Legal memo generator
- Regulatory watch module
- Admin audit view
- Responsive web UI for desktop and mobile browser use

## Run locally

```bash
cp .env.example .env
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:8080`

Keep all secrets only in your local or server environment file.

## Demo users

- Admin: `admin@synesis.local`
- Investor: `investor@synesis.local`
- Reviewer: `reviewer@synesis.local`

Passwords are configured in `.env`.

## Limitation

This is a private investor-ready technical build. Before public or institutional use, add persistent database, encrypted document storage, matter permissions, password hashing, role management, deployment protection, formal logs and privacy review.
