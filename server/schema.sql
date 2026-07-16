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
  role text NOT NULL CHECK (role IN ('admin', 'legal', 'compliance', 'kyc', 'management', 'risk', 'business')),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
VALUES ('2026-07-16-live-synesis-3')
ON CONFLICT (version) DO NOTHING;
