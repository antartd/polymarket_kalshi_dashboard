import { pool } from "../db.js";

export async function runCleanupJob() {
  await pool.query(
    "DELETE FROM raw_trades WHERE trade_ts < NOW() - INTERVAL '30 days'",
  );
}
