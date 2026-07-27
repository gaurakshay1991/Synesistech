import { neon } from '@neondatabase/serverless';
import { normalizeDatabaseUrl } from './config.js';

const MIGRATION = '2026-07-27-analysis-provenance-v1';

export async function synchronizeAnalysisProvenance() {
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!databaseUrl) return { configured: false, migration: MIGRATION };

  const sql = neon(databaseUrl);

  await sql`
    CREATE OR REPLACE FUNCTION normalize_synesis_analysis_provenance()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      live_used boolean := COALESCE(NULLIF(NEW.analysis #>> '{analysis_details,live_ai_used}', '')::boolean, false);
      provider_message text := COALESCE(NEW.analysis #>> '{analysis_details,failure}', '');
    BEGIN
      IF NOT live_used THEN
        NEW.analysis := jsonb_set(
          COALESCE(NEW.analysis, '{}'::jsonb),
          '{engine}',
          to_jsonb('deterministic-prototype-analysis'::text),
          true
        );
        NEW.analysis := jsonb_set(
          NEW.analysis,
          '{analysis_details,mode}',
          to_jsonb('prototype'::text),
          true
        );
        NEW.analysis := jsonb_set(
          NEW.analysis,
          '{analysis_details,provider_status}',
          to_jsonb(CASE WHEN provider_message = '' THEN 'not-configured' ELSE 'unavailable' END::text),
          true
        );

        IF NEW.status IN (
          'AI Review Complete',
          'Analysis Complete',
          'Fallback — Review Incomplete',
          'Analysis Unavailable'
        ) THEN
          NEW.status := 'Prototype Analysis Complete';
        END IF;
      ELSIF NEW.status = 'Prototype Analysis Complete' THEN
        NEW.status := 'AI Review Complete';
      END IF;

      RETURN NEW;
    END;
    $$
  `;

  await sql`DROP TRIGGER IF EXISTS documents_analysis_provenance ON documents`;
  await sql`
    CREATE TRIGGER documents_analysis_provenance
    BEFORE INSERT OR UPDATE OF analysis, status ON documents
    FOR EACH ROW
    EXECUTE FUNCTION normalize_synesis_analysis_provenance()
  `;

  await sql`
    UPDATE documents
    SET analysis = analysis,
        status = status,
        updated_at = updated_at
    WHERE deleted_at IS NULL
      AND COALESCE(NULLIF(analysis #>> '{analysis_details,live_ai_used}', '')::boolean, false) = false
  `;

  await sql`
    INSERT INTO schema_migrations (version)
    VALUES (${MIGRATION})
    ON CONFLICT (version) DO NOTHING
  `;

  console.log(`Analysis provenance controls synchronized (${MIGRATION}).`);
  return { configured: true, migration: MIGRATION };
}
