import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://dashboard:dashboard@localhost:5432/dashboard",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
