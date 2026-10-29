import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { notifyPhaseStarted } from "@/lib/competition";
import { addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { timelineOf } from "@/lib/timeline";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { applyTimelineTemplate, saveTimeline, saveTimelineTemplate, tickItem } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const today = "2026-10-29";

async function setup() {
  const coach = await createUser({ email: uniqueEmail("tl-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("tl-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const client = await db.client.findUniqueOrThrow({ where: { userId: user.id } });
  const competition = await db.competition.create({ data: { clientId: client.id, name: "Maraton", date: addDays(today, 10), priority: "A" } });
  return { coach, user, client, competition };
}
const stored = async (id: string) => timelineOf((await db.competition.findUniqueOrThrow({ where: { id } })).timeline);

test("the coach writes a timeline and saves it as a template; applying it elsewhere is a copy the client ticks", async () => {
  const { coach, user, client, competition } = await setup();
  request.cookie = await signIn(coach.email);
  const lines = { competitionId: competition.id, "priorities.2_WEEKS": "No new foods", "tasks.2_WEEKS": "Test gels\nPlan meals", "packing.FOOD": "Gels ×6" };
  expect(await saveTimeline(form(lines))).toBeNull();
  expect(await saveTimelineTemplate(form({ competitionId: competition.id, name: " Marathon " }))).toBeNull();
  const template = await db.timelineTemplate.findFirstOrThrow({ where: { coachId: coach.id } });
  expect(template).toMatchObject({ name: "Marathon", content: { phases: { "2_WEEKS": { priorities: "No new foods", tasks: ["Test gels", "Plan meals"] } }, packing: [{ group: "FOOD", text: "Gels ×6" }] } });

  const next = await db.competition.create({ data: { clientId: client.id, name: "Půlmaraton", date: addDays(today, 40), priority: "B" } });
  await applyTimelineTemplate(form({ competitionId: next.id, templateId: template.id }));
  const copy = await stored(next.id);
  expect(copy.phases["2_WEEKS"]!.tasks.map((t) => [t.text, t.done])).toEqual([
    ["Test gels", false],
    ["Plan meals", false],
  ]);
  expect(copy.phases["2_WEEKS"]!.tasks[0].id).not.toBe((await stored(competition.id)).phases["2_WEEKS"]!.tasks[0].id);

  request.cookie = await signIn(user.email);
  await tickItem(form({ competitionId: next.id, id: copy.phases["2_WEEKS"]!.tasks[0].id, done: "true" }));
  expect((await stored(next.id)).phases["2_WEEKS"]!.tasks[0].done).toBe(true);
  // The template and the first competition don't change with the copy.
  expect((await db.timelineTemplate.findUniqueOrThrow({ where: { id: template.id } })).content).toEqual(template.content);
  expect((await stored(competition.id)).phases["2_WEEKS"]!.tasks.every((t) => !t.done)).toBe(true);
});

test("the client can't write timelines or templates; another client or coach can't tick or apply", async () => {
  const { coach, user, competition } = await setup();
  request.cookie = await signIn(coach.email);
  await saveTimeline(form({ competitionId: competition.id, "tasks.RACE_DAY": "Breakfast 3 h before" }));
  await saveTimelineTemplate(form({ competitionId: competition.id, name: "Mine" }));
  const template = await db.timelineTemplate.findFirstOrThrow({ where: { coachId: coach.id } });
  const task = (await stored(competition.id)).phases.RACE_DAY!.tasks[0];

  request.cookie = await signIn(user.email);
  await expect(saveTimeline(form({ competitionId: competition.id, "tasks.RACE_DAY": "" }))).rejects.toMatchObject(redirectsTo("/app"));
  await expect(applyTimelineTemplate(form({ competitionId: competition.id, templateId: template.id }))).rejects.toMatchObject(redirectsTo("/app"));
  await expect(tickItem(form({ competitionId: competition.id, id: "nope", done: "true" }))).rejects.toMatchObject(notFound);

  const other = await setup();
  request.cookie = await signIn(other.user.email);
  await expect(tickItem(form({ competitionId: competition.id, id: task.id, done: "true" }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(other.coach.email);
  await expect(applyTimelineTemplate(form({ competitionId: other.competition.id, templateId: template.id }))).rejects.toMatchObject(notFound); // not their template
  await expect(tickItem(form({ competitionId: competition.id, id: task.id, done: "true" }))).rejects.toMatchObject(notFound);
  expect((await stored(competition.id)).phases.RACE_DAY!.tasks).toMatchObject([{ text: "Breakfast 3 h before", done: false }]);
});

test("the 'phase started' notification is created once per competition and phase", async () => {
  const { user, client, competition } = await setup();
  await notifyPhaseStarted(user.id, client.id, today);
  await notifyPhaseStarted(user.id, client.id, today);
  expect(await db.notification.findMany({ where: { userId: user.id } })).toMatchObject([{ type: "COMPETITION_PHASE_STARTED", payload: { competition: "Maraton" }, key: `${competition.id}:2_WEEKS` }]);
  await notifyPhaseStarted(user.id, client.id, addDays(today, 4)); // 6 days out: race week
  expect(await db.notification.count({ where: { userId: user.id } })).toBe(2);
});
