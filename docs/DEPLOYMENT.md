# Deployment / Local Operation

## Local private run

1. Clone the private repository.
2. Copy `.env.example` to `.env`.
3. Add your real OpenAI project API key to `.env` on your machine or server only.
4. Run:

```bash
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:8080`

## Private investor demo

Use one of these:

- Local laptop screen-share.
- Private office network.
- Private Vercel/Render deployment behind authentication.
- VPN/private tunnel for selected investors.

## Environment variables

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `INVESTOR_EMAIL`
- `INVESTOR_PASSWORD`
- `REVIEWER_EMAIL`
- `REVIEWER_PASSWORD`

## Production notes

Before wider use, add persistent database, password hashing, matter-level permissions, document storage encryption, deletion controls and formal audit logs.
