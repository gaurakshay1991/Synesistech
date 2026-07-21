CREATE TABLE IF NOT EXISTS regulatory_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  regulator text,
  regulatory_reference text,
  jurisdiction text NOT NULL DEFAULT 'India',
  effective_date date,
  accountable_owner text,
  status text NOT NULL DEFAULT 'Intake' CHECK (status IN ('Intake','Impact assessment','Remediation','Approval','Closed')),
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  source_file_name text,
  source_text_encrypted jsonb,
  source_fingerprint text,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text,
  closure_statement text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_email text NOT NULL,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS regulatory_cases_org_status_idx ON regulatory_cases (organization_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS regulatory_cases_reference_idx ON regulatory_cases (organization_id, regulatory_reference) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS regulatory_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES regulatory_cases(id) ON DELETE CASCADE,
  source_reference text,
  statement text NOT NULL,
  owner text,
  due_date date,
  status text NOT NULL DEFAULT 'Assessment required' CHECK (status IN ('Assessment required','Confirmed applicable','Not applicable','Implemented')),
  applicability_basis text,
  evidence_required text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regulatory_obligations_case_idx ON regulatory_obligations (organization_id, case_id, sort_order);
CREATE INDEX IF NOT EXISTS regulatory_obligations_status_idx ON regulatory_obligations (organization_id, status, due_date);

CREATE TABLE IF NOT EXISTS regulatory_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES regulatory_cases(id) ON DELETE CASCADE,
  area text NOT NULL,
  control_reference text,
  policy_reference text,
  system_or_process text,
  owner text,
  status text NOT NULL DEFAULT 'Mapping required' CHECK (status IN ('Mapping required','Impact confirmed','No impact','Remediated')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regulatory_impacts_case_idx ON regulatory_impacts (organization_id, case_id, status);

CREATE TABLE IF NOT EXISTS regulatory_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES regulatory_cases(id) ON DELETE CASCADE,
  obligation_id uuid REFERENCES regulatory_obligations(id) ON DELETE SET NULL,
  title text NOT NULL,
  owner text,
  priority text NOT NULL DEFAULT 'Planned' CHECK (priority IN ('Immediate','High','Planned','Low')),
  due_date date,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In progress','Blocked','Completed')),
  approval_gate text,
  evidence_required text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regulatory_tasks_case_idx ON regulatory_tasks (organization_id, case_id, status, due_date);
CREATE INDEX IF NOT EXISTS regulatory_tasks_owner_idx ON regulatory_tasks (organization_id, owner, status, due_date);

CREATE TABLE IF NOT EXISTS regulatory_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES regulatory_cases(id) ON DELETE CASCADE,
  approval_function text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Approved with conditions','Returned','Rejected')),
  comment text,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_by_email text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, approval_function)
);

CREATE INDEX IF NOT EXISTS regulatory_approvals_case_idx ON regulatory_approvals (organization_id, case_id, status);

CREATE TABLE IF NOT EXISTS regulatory_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES regulatory_cases(id) ON DELETE CASCADE,
  task_id uuid REFERENCES regulatory_tasks(id) ON DELETE SET NULL,
  obligation_id uuid REFERENCES regulatory_obligations(id) ON DELETE SET NULL,
  title text NOT NULL,
  note text,
  evidence_owner text,
  storage_reference text,
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regulatory_evidence_case_idx ON regulatory_evidence (organization_id, case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS institutional_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type text NOT NULL CHECK (object_type IN ('regulation','obligation','contract','clause','policy','control','product','process','system','entity','counterparty','owner','evidence','decision','exception','incident','task')),
  name text NOT NULL,
  description text,
  external_reference text,
  status text NOT NULL DEFAULT 'Active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS institutional_objects_org_type_idx ON institutional_objects (organization_id, object_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS institutional_objects_metadata_gin_idx ON institutional_objects USING gin (metadata);

CREATE TABLE IF NOT EXISTS institutional_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_object_id uuid NOT NULL REFERENCES institutional_objects(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  target_object_id uuid NOT NULL REFERENCES institutional_objects(id) ON DELETE CASCADE,
  regulatory_case_id uuid REFERENCES regulatory_cases(id) ON DELETE SET NULL,
  confidence numeric(5,2),
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_object_id, relation_type, target_object_id)
);

CREATE INDEX IF NOT EXISTS institutional_links_source_idx ON institutional_links (organization_id, source_object_id, relation_type);
CREATE INDEX IF NOT EXISTS institutional_links_target_idx ON institutional_links (organization_id, target_object_id, relation_type);

INSERT INTO schema_migrations (version)
VALUES ('2026-07-20-regulatory-change-to-control-v1')
ON CONFLICT (version) DO NOTHING;
