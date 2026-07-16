# LIVE SYNESIS engineering rules

- The uploaded document must remain the active source of truth across Review, Scenario Testing, Regulatory/KYC, Reports and Assistant.
- Do not add fixed sample findings or generic scenarios to the production path.
- Every finding must include document evidence, Bank-specific risk reasoning, risk level, score, impact, mitigation, rewrite and owner.
- Keep model output behind a strict schema and validate before rendering.
- Preserve the deterministic baseline engine as a fallback and evaluation control.
- Never log or expose `OPENAI_API_KEY`, raw credentials or full sensitive document text.
- Treat current JSON persistence as MVP-only; production work must move files and results to approved encrypted storage and a tenant-aware database.
- Add tests whenever analysis logic changes. The defective agreement must score materially above the corrected agreement, and clause changes must change corresponding findings.
