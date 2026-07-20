BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'admin', 'legal', 'compliance', 'kyc', 'management', 'risk', 'business',
    'investment', 'operations', 'technology', 'finance', 'board', 'procurement', 'audit'
  )
) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_role_check;

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

INSERT INTO schema_migrations (version)
VALUES ('2026-07-20-institutional-os-4')
ON CONFLICT (version) DO NOTHING;

COMMIT;
