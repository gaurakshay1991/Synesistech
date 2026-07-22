# PARMA — Product Scope

PARMA is an explainable institutional risk decision operating system for deals, transactions, procurement, contracts, counterparties and advisory matters.

## Core workflow

Intake → evidence → structured risk drivers → quantified exposure → controls → approval → action → evidence → closure.

## Quantification model

PARMA separates:

- inherent risk score;
- residual risk score after controls;
- maximum reasonably foreseeable exposure;
- probability-weighted expected loss;
- residual expected loss after controls;
- risk-adjusted transaction value.

Outputs are decision-support estimates. They are not accounting provisions, legal opinions or regulatory capital calculations unless an institution configures and validates a specific approved model.

## Production requirements

- organization and tenant isolation;
- authentication, RBAC and SSO;
- PostgreSQL persistence;
- encrypted document storage;
- document extraction with source citations;
- configurable risk models and approval thresholds;
- complete audit history;
- workflow notifications and evidence-backed closure;
- APIs and enterprise connectors;
- observability, backup and disaster recovery;
- model governance, evaluation and human approval controls.
