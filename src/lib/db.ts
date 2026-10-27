import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Same default as prisma.config.ts, so no .env is needed.
export const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";

// One client per process: dev hot reload would otherwise open a new connection on every change.
const globalForDb = globalThis as unknown as { db?: PrismaClient };
export const db = globalForDb.db ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
