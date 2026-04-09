import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://dashboard:dashboard@localhost:5432/dashboard";

export const pool = new Pool({
  connectionString: databaseUrl,
});
