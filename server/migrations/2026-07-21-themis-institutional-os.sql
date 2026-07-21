CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS institutional_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  name text NOT NULL,
  description text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_label text,
  status text NOT NULL DEFAULT 'Active',
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS institutional_objects_org_type_idx
  ON institutional_objects (organization_id, object_type, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS institutional_objects_metadata_gin_idx
  ON institutional_objects USING gin (metadata);

CREATE TABLE IF NOT EXISTS institutional_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_object_id uuid NOT NULL REFERENCES institutional_objects(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  target_object_id uuid NOT NULL REFERENCES institutional_objects(id) ON DELETE CASCADE,
  evidence_reference text,
  confidence numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institutional_relationship_not_self CHECK (source_object_id <> target_object_id)
);

CREATE INDEX IF NOT EXISTS institutional_relationships_source_idx
  ON institutional_relationships (organization_id, source_object_id);
CREATE INDEX IF NOT EXISTS institutional_relationships_target_idx
  ON institutional_relationships (organization_id, target_object_id);

CREATE TABLE IF NOT EXISTS product_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_key text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_label text,
  due_date date,
  priority text,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS product_records_org_product_idx
  ON product_records (organization_id, product_key, status, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_records_data_gin_idx
  ON product_records USING gin (data);

CREATE TABLE IF NOT EXISTS institutional_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_record_id uuid REFERENCES product_records(id) ON DELETE SET NULL,
  title text NOT NULL,
  decision_text text NOT NULL,
  rationale text,
  facts_relied_upon jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  authority text,
  approver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  conditions text,
  status text NOT NULL DEFAULT 'Proposed',
  valid_until date,
  outcome text,
  supersedes_decision_id uuid REFERENCES institutional_decisions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_decisions_org_status_idx
  ON institutional_decisions (organization_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS institutional_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_record_id uuid REFERENCES product_records(id) ON DELETE CASCADE,
  related_object_id uuid REFERENCES institutional_objects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_label text,
  priority text NOT NULL DEFAULT 'Planned',
  status text NOT NULL DEFAULT 'Open',
  due_date date,
  approval_gate text,
  evidence_requirement text,
  completed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_tasks_org_due_idx
  ON institutional_tasks (organization_id, status, due_date);

CREATE TABLE IF NOT EXISTS institutional_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_record_id uuid REFERENCES product_records(id) ON DELETE CASCADE,
  task_id uuid REFERENCES institutional_tasks(id) ON DELETE SET NULL,
  related_object_id uuid REFERENCES institutional_objects(id) ON DELETE SET NULL,
  title text NOT NULL,
  evidence_type text,
  storage_reference text,
  content_sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Submitted',
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_evidence_org_status_idx
  ON institutional_evidence (organization_id, status, expires_at);

CREATE TABLE IF NOT EXISTS ai_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  name text NOT NULL,
  version text,
  provider text,
  model text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  risk_tier text NOT NULL DEFAULT 'Moderate',
  status text NOT NULL DEFAULT 'Proposed',
  permitted_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  permitted_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_gate text,
  evaluation_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_assets_org_status_idx
  ON ai_assets (organization_id, asset_type, status);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ai_asset_id uuid REFERENCES ai_assets(id) ON DELETE SET NULL,
  benchmark_name text NOT NULL,
  workflow text,
  model_version text,
  prompt_version text,
  expected_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  defects jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Running',
  release_decision text,
  run_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS evaluation_runs_org_created_idx
  ON evaluation_runs (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS integration_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_name text NOT NULL,
  integration_type text NOT NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Planned',
  data_flow jsonb NOT NULL DEFAULT '{}'::jsonb,
  authentication_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  health jsonb NOT NULL DEFAULT '{}'::jsonb,
  fallback_procedure text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_registry_org_status_idx
  ON integration_registry (organization_id, status, updated_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('2026-07-21-themis-institutional-os')
ON CONFLICT (version) DO NOTHING;
