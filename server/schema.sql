CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'admin', 'legal', 'compliance', 'kyc', 'management', 'risk', 'business',
    'investment', 'operations', 'technology', 'finance', 'board', 'procurement', 'audit'
  )
) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_role_check;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_organization_idx
  ON users (organization_id, is_active);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  matter text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'India',
  risk_appetite text NOT NULL DEFAULT 'Conservative',
  document_type text NOT NULL,
  original_file_name text,
  mime_type text,
  size_bytes integer NOT NULL DEFAULT 0,
  parser text,
  truncated boolean NOT NULL DEFAULT false,
  content_sha256 text,
  encrypted_text jsonb NOT NULL,
  analysis jsonb NOT NULL,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by_email text NOT NULL,
  status text NOT NULL DEFAULT 'AI Review Complete',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS documents_organization_updated_idx
  ON documents (organization_id, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_status_idx
  ON documents (organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_analysis_gin_idx
  ON documents USING gin (analysis);

CREATE TABLE IF NOT EXISTS institutional_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  title text NOT NULL,
  source_type text NOT NULL,
  function_name text NOT NULL,
  status text NOT NULL DEFAULT 'Decision Required',
  overall_risk text NOT NULL DEFAULT 'Medium',
  overall_score integer,
  recommended_decision text,
  executive_position text,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT institutional_events_score_check CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS institutional_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  name text NOT NULL,
  external_key text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS institutional_objects_external_key_unique
  ON institutional_objects (organization_id, object_type, external_key)
  WHERE external_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS institutional_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_object_id uuid NOT NULL REFERENCES institutional_objects(id) ON DELETE CASCADE,
  to_object_id uuid NOT NULL REFERENCES institutional_objects(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  source_event_id uuid REFERENCES institutional_events(id) ON DELETE SET NULL,
  confidence numeric(5,2),
  evidence text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institutional_relationships_confidence_check CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  CONSTRAINT institutional_relationships_not_self CHECK (from_object_id <> to_object_id)
);

CREATE TABLE IF NOT EXISTS institutional_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES institutional_events(id) ON DELETE CASCADE,
  actor text,
  obligation text NOT NULL,
  trigger_condition text,
  deadline_or_frequency text,
  evidence_required text,
  consequence text,
  owner text,
  status text NOT NULL DEFAULT 'Open',
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES institutional_events(id) ON DELETE CASCADE,
  question text NOT NULL,
  owner text,
  approval_gate text,
  status text NOT NULL DEFAULT 'Pending',
  comment text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES institutional_events(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES institutional_decisions(id) ON DELETE SET NULL,
  title text NOT NULL,
  owner text,
  priority text NOT NULL DEFAULT 'Before Approval',
  approval_gate text,
  evidence_required text,
  status text NOT NULL DEFAULT 'Open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES institutional_events(id) ON DELETE CASCADE,
  action_id uuid REFERENCES institutional_actions(id) ON DELETE SET NULL,
  title text NOT NULL,
  note text NOT NULL DEFAULT '',
  storage_reference text,
  content_sha256 text,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_events_queue_idx
  ON institutional_events (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS institutional_events_risk_idx
  ON institutional_events (organization_id, overall_risk, updated_at DESC)
  WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS institutional_objects_type_idx
  ON institutional_objects (organization_id, object_type, name);
CREATE INDEX IF NOT EXISTS institutional_relationships_from_idx
  ON institutional_relationships (organization_id, from_object_id, relationship_type);
CREATE INDEX IF NOT EXISTS institutional_relationships_to_idx
  ON institutional_relationships (organization_id, to_object_id, relationship_type);
CREATE INDEX IF NOT EXISTS institutional_obligations_event_idx
  ON institutional_obligations (organization_id, event_id, status);
CREATE INDEX IF NOT EXISTS institutional_decisions_queue_idx
  ON institutional_decisions (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS institutional_actions_queue_idx
  ON institutional_actions (organization_id, status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS institutional_actions_event_idx
  ON institutional_actions (organization_id, event_id, status);
CREATE INDEX IF NOT EXISTS institutional_evidence_event_idx
  ON institutional_evidence (organization_id, event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  role text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_organization_created_idx
  ON audit_events (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version)
VALUES ('2026-07-20-institutional-os-4')
ON CONFLICT (version) DO NOTHING;
