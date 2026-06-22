# Synesis API

Base URL: `http://localhost:8080`

## Public

- `GET /api/health`
- `POST /api/auth/login`

## Authenticated

Use `Authorization: Bearer <token>`.

- `POST /api/legal/research`
- `POST /api/contracts/review`
- `POST /api/clauses/rewrite`
- `POST /api/memo/generate`
- `POST /api/regulatory/watch`
- `POST /api/export/text`
- `GET /api/admin/audit` admin only

## Legal research payload

```json
{
  "query": "What is the latest RBI position on digital lending?",
  "jurisdiction": "India"
}
```

## Contract review payload

```json
{
  "text": "Paste agreement text here"
}
```
