import { pool } from "../db.js";

export async function getCursor(sourceName: string): Promise<string | null> {
  const result = await pool.query<{ cursor_value: string | null }>(
    "SELECT cursor_value FROM ingestion_state WHERE source_name = $1",
    [sourceName],
  );

  return result.rows[0]?.cursor_value ?? null;
}

export async function setCursor(sourceName: string, cursorValue: string | null, metadata: unknown = {}) {
  await pool.query(
    `
      INSERT INTO ingestion_state (source_name, cursor_value, last_success_at, last_attempt_at, metadata)
      VALUES ($1, $2, NOW(), NOW(), $3::jsonb)
      ON CONFLICT (source_name)
      DO UPDATE SET
        cursor_value = EXCLUDED.cursor_value,
        last_success_at = NOW(),
        last_attempt_at = NOW(),
        metadata = EXCLUDED.metadata
    `,
    [sourceName, cursorValue, JSON.stringify(metadata)],
  );
}

export async function markAttempt(sourceName: string, metadata: unknown = {}) {
  await pool.query(
    `
      INSERT INTO ingestion_state (source_name, last_attempt_at, metadata)
      VALUES ($1, NOW(), $2::jsonb)
      ON CONFLICT (source_name)
      DO UPDATE SET
        last_attempt_at = NOW(),
        metadata = EXCLUDED.metadata
    `,
    [sourceName, JSON.stringify(metadata)],
  );
}
