import { neon } from '@neondatabase/serverless';
import { config } from './config.js';

const GOVERNANCE_MIGRATION = '2026-07-26-human-oversight-governance-v2';
const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

const statements = [
  `CREATE OR REPLACE FUNCTION enforce_synesis_document_governance()
   RETURNS trigger
   LANGUAGE plpgsql
   AS $$
   DECLARE
     live_used boolean := COALESCE((NEW.analysis #>> '{analysis_details,live_ai_used}')::boolean, false);
     latest_decision jsonb;
     reviewer_role text;
     reviewer_id_text text;
     rationale text;
     decision_action text;
   BEGIN
     NEW.analysis := jsonb_set(
       COALESCE(NEW.analysis, '{}'::jsonb),
       '{governance}',
       COALESCE(NEW.analysis->'governance', '{}'::jsonb) ||
         jsonb_build_object(
           'mode', 'human-in-the-loop',
           'advisoryOnly', true,
           'finalDecisionByHuman', true,
           'namedReviewerRequired', true,
           'recordedRationaleRequired', true,
           'emergencyFallbackMayNotBeCompleted', true,
           'prohibitedAutonomousEmploymentDecisions',
             jsonb_build_array(
               'hiring or candidate rejection',
               'termination, dismissal or redundancy',
               'promotion or demotion',
               'compensation or benefits',
               'disciplinary action',
               'performance rating or ranking'
             ),
           'analysisCompleted', live_used
         ),
       true
     );

     IF NOT live_used THEN
       NEW.status := 'Analysis Unavailable';
     ELSIF NEW.status IN ('AI Review Complete', 'Analysis Complete') THEN
       NEW.status := 'Pending Human Review';
     END IF;

     IF NEW.status IN ('Final Approved', 'Rejected', 'Closed') THEN
       IF NOT live_used THEN
         RAISE EXCEPTION 'Incomplete or fallback analysis cannot receive a final status.';
       END IF;

       IF jsonb_typeof(NEW.decisions) IS DISTINCT FROM 'array'
          OR COALESCE(jsonb_array_length(NEW.decisions), 0) = 0 THEN
         RAISE EXCEPTION 'A named human review decision is required before final status.';
       END IF;

       latest_decision := NEW.decisions->0;
       reviewer_id_text := COALESCE(latest_decision->>'userId', '');
       rationale := btrim(COALESCE(latest_decision->>'comment', ''));
       decision_action := COALESCE(latest_decision->>'status', '');

       IF reviewer_id_text !~* '${UUID_PATTERN}' THEN
         RAISE EXCEPTION 'A valid named reviewer is required before final status.';
       END IF;

       SELECT role INTO reviewer_role
       FROM users
       WHERE id = reviewer_id_text::uuid
         AND organization_id = NEW.organization_id
         AND is_active = true;

       IF reviewer_role IS NULL OR reviewer_role NOT IN ('admin', 'legal', 'compliance', 'risk') THEN
         RAISE EXCEPTION 'Only an active authorised reviewer may set a final status.';
       END IF;

       IF length(rationale) < 30 THEN
         RAISE EXCEPTION 'A substantive human rationale of at least 30 characters is required.';
       END IF;

       IF decision_action NOT IN ('Resolved', 'Accepted With Controls', 'Rejected') THEN
         RAISE EXCEPTION 'The final review action must be Resolved, Accepted With Controls, or Rejected.';
       END IF;
     END IF;

     RETURN NEW;
   END;
   $$`,
  'DROP TRIGGER IF EXISTS documents_human_governance ON documents',
  `CREATE TRIGGER documents_human_governance
   BEFORE INSERT OR UPDATE ON documents
   FOR EACH ROW
   EXECUTE FUNCTION enforce_synesis_document_governance()`,
  `UPDATE documents AS d
   SET status = CASE
     WHEN NOT COALESCE((d.analysis #>> '{analysis_details,live_ai_used}')::boolean, false)
       THEN 'Analysis Unavailable'
     WHEN d.status IN ('AI Review Complete', 'Analysis Complete')
       THEN 'Pending Human Review'
     WHEN d.status IN ('Final Approved', 'Rejected', 'Closed')
       AND NOT (
         jsonb_typeof(d.decisions) = 'array'
         AND COALESCE(jsonb_array_length(d.decisions), 0) > 0
         AND COALESCE(d.decisions->0->>'userId', '') ~* '${UUID_PATTERN}'
         AND length(btrim(COALESCE(d.decisions->0->>'comment', ''))) >= 30
         AND COALESCE(d.decisions->0->>'status', '') IN ('Resolved', 'Accepted With Controls', 'Rejected')
         AND EXISTS (
           SELECT 1
           FROM users AS u
           WHERE u.id = CASE
             WHEN COALESCE(d.decisions->0->>'userId', '') ~* '${UUID_PATTERN}'
               THEN (d.decisions->0->>'userId')::uuid
             ELSE NULL
           END
             AND u.organization_id = d.organization_id
             AND u.is_active = true
             AND u.role IN ('admin', 'legal', 'compliance', 'risk')
         )
       )
       THEN 'Pending Human Review'
     ELSE d.status
   END,
   updated_at = now()
   WHERE d.deleted_at IS NULL`,
  `INSERT INTO schema_migrations (version)
   VALUES ('${GOVERNANCE_MIGRATION}')
   ON CONFLICT (version) DO NOTHING`
];

export async function synchronizeGovernanceControls() {
  if (!config.databaseUrl) return { configured: false, migration: null };

  const sql = neon(config.databaseUrl);
  for (const statement of statements) {
    await sql.query(statement, []);
  }

  return { configured: true, migration: GOVERNANCE_MIGRATION };
}
