# SYNESIS NEW MODEL 3.0

This branch is reserved for the separate successor model requested on 21 July 2026. The existing `main` branch and LIVE SYNESIS project remain unchanged.

## Product category

**Regulatory Decision Assurance and Execution Platform for regulated financial institutions.**

The new model is designed around five connected engines:

1. Institutional Decision Twin
2. Obligation Compiler
3. Regulatory Impact Graph
4. Governed Execution and Evidence Engine
5. Decision Memory and Learning Loop

It also adds a universal institutional scenario engine, while retaining document ingestion, multipass evidence review, clause-level findings, active-document Q&A, role controls, approvals, auditability and solution packs.

## Separate build

A complete standalone Node/React/Docker source package named `synesis-new-model-3.0` has been created and validated outside Replit and Vercel. It includes secure login, encrypted source persistence, live upload and analysis endpoints, obligation compilation, impact mapping, decision gates, task execution, evidence verification, institutional graphing, simulations, reports and AI-control governance.

Validation completed:

- server regression tests passed;
- production React build passed;
- health endpoint passed;
- login and mandatory password replacement passed;
- command-centre bootstrap passed;
- document analysis and compilation into the Institutional Twin passed;
- emergency fallback was explicitly labelled and not represented as completed live analysis.

The standalone pilot is platform-neutral and can run through Node or Docker. Before regulated production deployment, connect it to the retained PostgreSQL/Neon persistence adapter or another institution-approved PostgreSQL environment and complete the security, model-risk, data-residency and regulatory controls described in the source package.