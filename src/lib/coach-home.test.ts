import { expect, test, vi } from "vitest";
import { createUser } from "./auth";
import { type ClientRow, needsAttention } from "./client-list";
import { coachHome } from "./coach-home";
import { db } from "./db";
import { uniqueEmail } from "@/test/auth";

// Every query the app's client runs, counted.
const queries = vi.hoisted(() => ({ count: 0 }));
vi.mock("./db", async () => {
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }), log: [{ emit: "event", level: "query" }] });
  db.$on("query", () => queries.count++);
  return { db, dbUrl: process.env.DATABASE_URL };
});

const row = (name: string, change: Partial<ClientRow>): ClientRow => ({
  ...{ id: name, name, email: `${name}@x.cz`, trackingMode: "CALORIES", status: "ACTIVE", checkIn: "ok", nextCompetition: null, unread: 0 },
  ...{ daysSinceOnboarding: 30, noPlan: false, lastLogged: "2026-10-28", daysAgo: 1, adherence: 80 },
  ...change,
});

test("needs attention: each reason, never logged counted from onboarding, active clients only", () => {
  const rows = [
    row("fine", {}),
    row("quiet", { daysAgo: 2 }),
    row("new", { daysAgo: null, lastLogged: null, daysSinceOnboarding: 1 }), // onboarded yesterday: not yet
    row("silent", { daysAgo: null, lastLogged: null, daysSinceOnboarding: 3, noPlan: true }),
    row("late", { checkIn: "overdue", unread: 2 }),
    row("sent", { checkIn: "toReview" }),
    row("onboarding", { status: "ONBOARDING", noPlan: true, daysAgo: null, daysSinceOnboarding: null }),
    row("gone", { status: "INACTIVE", daysAgo: 9 }),
  ];
  expect(needsAttention(rows).map((a) => [a.row.name, a.reasons])).toEqual([
    ["quiet", ["NOT_LOGGED"]],
    ["silent", ["NOT_LOGGED", "NO_PLAN"]],
    ["late", ["CHECK_IN_OVERDUE", "UNREAD"]],
    ["sent", ["CHECK_IN_TO_REVIEW"]],
  ]);
});

async function coachWith(clients: number) {
  const coach = await createUser({ email: uniqueEmail("home-coach"), name: "Coach", role: "COACH" });
  for (let i = 0; i < clients; i++) {
    await createUser({ email: uniqueEmail(`home-client-${i}`), name: `Client ${i}`, role: "CLIENT", client: { create: { coachId: coach.id, onboardingCompletedAt: new Date() } } });
  }
  return coach;
}

test("the coach home runs the same number of queries for 3 and for 20 clients", async () => {
  const [few, many] = [await coachWith(3), await coachWith(20)];
  queries.count = 0;
  const home = await coachHome(few);
  const forFew = queries.count;
  queries.count = 0;
  await coachHome(many);
  expect(forFew).toBeGreaterThan(10); // the counter sees the queries
  expect(queries.count).toBe(forFew);
  expect(home).toMatchObject({ activeClients: 3, checkInsWaiting: 0, unreadMessages: 0, callsSoon: 0, competitions: [] });
  expect(home.attention.map((a) => a.reasons)).toEqual([["NO_PLAN"], ["NO_PLAN"], ["NO_PLAN"]]); // onboarded today, no plan
  expect(await db.client.count({ where: { coachId: many.id } })).toBe(20);
});
