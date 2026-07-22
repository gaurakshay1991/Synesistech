CREATE TABLE IF NOT EXISTS parma_matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  title TEXT NOT NULL,
  matter_type TEXT NOT NULL,
  counterparty TEXT,
  owner_name TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  matter_value NUMERIC(20,2) NOT NULL DEFAULT 0,
  probability_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  loss_severity_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  control_effectiveness_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  inherent_score INTEGER NOT NULL,
  residual_score INTEGER NOT NULL,
  risk_band TEXT NOT NULL,
  maximum_exposure NUMERIC(20,2) NOT NULL DEFAULT 0,
  expected_loss NUMERIC(20,2) NOT NULL DEFAULT 0,
  residual_expected_loss NUMERIC(20,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Assessment',
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parma_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES parma_matters(id) ON DELETE CASCADE,
  factor_key TEXT NOT NULL,
  factor_label TEXT NOT NULL,
  factor_weight NUMERIC(5,2) NOT NULL,
  score INTEGER NOT NULL,
  rationale TEXT,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS parma_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES parma_matters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_name TEXT,
  due_date DATE,
  effectiveness_percent NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'Proposed',
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parma_matters_org_status_idx ON parma_matters(organization_id, status);
CREATE INDEX IF NOT EXISTS parma_matters_risk_idx ON parma_matters(residual_score DESC, residual_expected_loss DESC);
