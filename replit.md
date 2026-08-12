# SYNESIS v9 — Replit build contract

This Replit App must run the canonical product under `model3`, not the older root-level app.

Primary objective: a real legal/compliance intelligence product, not a demo dashboard.

Operational rules:
- Never seed fake regulations, fake findings, fake alerts, fake memories, or generic legal answers into operational screens.
- Every uploaded document/matter must remain isolated from every other matter unless the user explicitly selects institution-wide scope.
- The exact uploaded document must drive findings, Q&A, clause actions, rewrites, mitigation, exposure reasoning, clearance and graph generation.
- Do not silently replace a failed neural/live-AI call with polished deterministic template output. Show provider failure truthfully.
- Preserve the governed provider router, deterministic controls, abstention and human-approval gates.
- Preserve current-law/regulatory audit, citations, amendment/supersession checks, compliance impact and regulatory-drift revalidation.
- Preserve clause action packs: materiality, must-fix/raise/accept/monitor/let-go, exact rewrite, fallback wording, mitigation, negotiation strategy and exposure basis.
- Preserve matter clearance: clear / clear with conditions / negotiate / escalate / do not clear.
- Preserve quantifiability discipline: express cap = bounded ceiling; uncapped = contractually unbounded; scenario estimate is not legal maximum; no reliable anchor = not reliably quantifiable.
- Preserve document-derived clause/entity/obligation/regulation graph and controlled clause memory.
- Keep iPhone/mobile PWA usability first-class.

Runtime:
- Replit starts the canonical `model3` application using the repository `.replit` configuration.
- Required secret: `DATABASE_URL` pointing to the canonical Neon v9 database.
- Optional provider/bootstrap secrets: `OPENAI_API_KEY` and/or provider credentials. Provider setup can also be completed from SYNESIS provider settings after login where supported.
- Do not commit any secret value to GitHub or Replit source.

Before calling the app ready, verify end-to-end with a newly created document containing unique clauses and facts. Confirm the returned analysis and rewrite quote or accurately track those unique clauses and do not reproduce unrelated historical findings.
