import { NextRequest } from "next/server";
import { expect, test, vi } from "vitest";
import { setCheckInWeekday } from "@/app/app/check-in/actions";
import { applyTimelineTemplate, deleteCompetition, deleteTimelineTemplate, saveCompetition, saveResult, saveTimeline, saveTimelineTemplate, tickItem } from "@/app/app/competition/actions";
import { deleteScheduleItem, duplicateScheduleItem, moveScheduleItem, saveScheduleItem, shiftSchedule, tickScheduleItem } from "@/app/app/competition/schedule-actions";
import { deleteFluid, deletePreset, logPreset, updateFluid } from "@/app/app/hydration/actions";
import { deleteMessage, sendMessage } from "@/app/app/messages/actions";
import { markRead, openNotification } from "@/app/app/notifications/actions";
import { saveDayNote, setDayType } from "@/app/app/nutrition/actions";
import { deleteEntry, updateEntry } from "@/app/app/nutrition/entry-actions";
import { deleteFood, saveFood } from "@/app/app/nutrition/food-actions";
import { deleteBodyComp, saveBodyComp } from "@/app/app/progress/actions";
import { deleteSupplement, saveSupplement } from "@/app/app/supplements/actions";
import { deleteSession, saveSession } from "@/app/app/training/actions";
import { GET as searchFoodsRoute } from "@/app/api/foods/route";
import { GET as unreadRoute } from "@/app/api/unread/route";
import { publishFeedback } from "@/app/coach/check-ins/actions";
import { changeTrackingMode } from "@/app/coach/clients/[id]/actions";
import { deleteCall, saveCall } from "@/app/coach/clients/[id]/calls/actions";
import { deleteNote, saveNote } from "@/app/coach/clients/[id]/notes/actions";
import { copyPlan, deleteMeal, deleteRecommendation, reorderPlan, saveMeal, saveRecommendation, saveSpecifics, saveTargets } from "@/app/coach/clients/[id]/nutrition/actions";
import { setClientActive } from "@/app/coach/clients/actions";
import { deleteFuelingTemplate, setFuelingOverride } from "@/app/coach/library/fueling/actions";
import { duplicateRecipe, setRecipeStatus } from "@/app/coach/library/recipes/actions";
import { createUser, requireClientAccess, requireCoach, requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromContent } from "@/lib/timeline";
import { notFound, redirectsTo, signIn, uniqueEmail } from "./auth";

// auth.md "Authorization": every action and route handler, tried by the wrong person against one client's data.
const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};
const day = "2026-10-27";

// Coach A with client A and one of everything; coach B with client B.
async function world() {
  const coachA = await createUser({ email: uniqueEmail("sweep-coach-a"), name: "Coach A", role: "COACH" });
  const coachB = await createUser({ email: uniqueEmail("sweep-coach-b"), name: "Coach B", role: "COACH" });
  const userA = await createUser({ email: uniqueEmail("sweep-client-a"), name: "Client A", role: "CLIENT", client: { create: { coachId: coachA.id, onboardingCompletedAt: new Date() } } });
  const userB = await createUser({ email: uniqueEmail("sweep-client-b"), name: "Client B", role: "CLIENT", client: { create: { coachId: coachB.id, onboardingCompletedAt: new Date() } } });
  const [clientA, clientB] = await Promise.all([userA, userB].map((u) => db.client.findUniqueOrThrow({ where: { userId: u.id } })));
  const clientId = clientA.id;
  const competition = await db.competition.create({
    data: { clientId, name: "Race", date: "2026-11-08", priority: "A", timeline: fromContent({ phases: { RACE_DAY: { priorities: "", tasks: ["Breakfast"] } }, packing: [] }) },
  });
  const ids = {
    clientId,
    competitionId: competition.id,
    taskId: (competition.timeline as { phases: { RACE_DAY: { tasks: { id: string }[] } } }).phases.RACE_DAY.tasks[0].id,
    entryId: (await db.foodEntry.create({ data: { clientId, date: day, slot: "Oběd", name: "Rice", kcal: 500, protein: 10, carbs: 100, fat: 5 } })).id,
    fluidId: (await db.fluidLog.create({ data: { clientId, date: day, ml: 500, drinkType: "WATER" } })).id,
    presetId: (await db.drinkPreset.create({ data: { clientId, name: "Mine", ml: 500, drinkType: "WATER" } })).id,
    messageId: (await db.message.create({ data: { clientId, senderId: userA.id, text: "Hi" } })).id,
    noteId: (await db.coachNote.create({ data: { clientId, date: day, type: "NOTE", text: "Private" } })).id,
    sessionId: (await db.trainingSession.create({ data: { clientId, date: day, type: "RUN", durationMin: 60, intensity: "MODERATE" } })).id,
    checkInId: (await db.checkIn.create({ data: { clientId, dueDate: "2026-10-26", answers: {} } })).id,
    bodyCompId: (await db.bodyComp.create({ data: { clientId, date: day, method: "SCALE", weightKg: 70 } })).id,
    supplementId: (await db.supplement.create({ data: { clientId, name: "Iron", category: "DAILY", addedByClient: true } })).id,
    callId: (await db.call.create({ data: { clientId, startsAt: new Date("2026-11-02T17:00:00Z"), durationMin: 30 } })).id,
    mealId: (await db.planMeal.create({ data: { clientId, dayType: "REST", position: 0, name: "Lunch" } })).id,
    recommendationId: (await db.planRecommendation.create({ data: { clientId, position: 0, title: "Sleep" } })).id,
    scheduleItemId: (await db.scheduleItem.create({ data: { competitionId: competition.id, time: "09:00", type: "EVENT", title: "Start" } })).id,
    foodId: (await db.food.create({ data: { name: "Babiččin koláč", kcal: 300, protein: 5, carbs: 40, fat: 12, source: "CLIENT", ownerId: userA.id } })).id,
    notificationId: (await db.notification.create({ data: { userId: userA.id, type: "PLAN_UPDATED", payload: {} } })).id,
    timelineTemplateId: (await db.timelineTemplate.create({ data: { coachId: coachA.id, name: "A's", content: { phases: {}, packing: [] } } })).id,
    fuelingTemplateId: (await db.fuelingTemplate.create({ data: { coachId: coachA.id, name: "A's" } })).id,
    recipeId: (await db.recipe.create({ data: { coachId: coachA.id, name: "A's recipe" } })).id,
    ownTemplateB: (await db.timelineTemplate.create({ data: { coachId: coachB.id, name: "B's", content: { phases: {}, packing: [] } } })).id,
    clientB: clientB.id,
  };
  return { coachA, coachB, userA, userB, ids };
}
type Ids = Awaited<ReturnType<typeof world>>["ids"];

// What client A and coach A own, to show nothing changed.
const stateOf = async (ids: Ids, coachId: string) =>
  JSON.stringify(
    await Promise.all([
      db.client.findUniqueOrThrow({ where: { id: ids.clientId }, include: { user: { select: { active: true } } } }),
      ...(["foodEntry", "fluidLog", "drinkPreset", "message", "coachNote", "trainingSession", "checkIn", "bodyComp", "supplement", "call", "planMeal", "planRecommendation", "competition", "nutritionTarget", "nutritionDay"] as const).map(
        (table) => (db[table] as unknown as { findMany: (args: object) => Promise<unknown> }).findMany({ where: { clientId: ids.clientId }, orderBy: { id: "asc" } }),
      ),
      db.scheduleItem.findMany({ where: { competitionId: ids.competitionId } }),
      db.food.findMany({ where: { id: ids.foodId } }),
      db.timelineTemplate.findMany({ where: { coachId } }),
      db.fuelingTemplate.findMany({ where: { coachId } }),
      db.recipe.findMany({ where: { coachId } }),
    ]),
  );

// The calls, grouped by how they decide who may: the client's coach only; the client or their coach; the signed-in client
// on their own rows; the signed-in user on their own rows; the coach's own library.
const coachOnly = (i: Ids) => [
  () => setCheckInWeekday(form({ clientId: i.clientId, weekday: "2" })),
  () => changeTrackingMode(form({ clientId: i.clientId, trackingMode: "PORTIONS" })),
  () => setClientActive(form({ clientId: i.clientId, active: "false" })),
  () => saveNote(form({ clientId: i.clientId, date: day, type: "NOTE", text: "x" })),
  () => deleteNote(form({ clientId: i.clientId, id: i.noteId })),
  () => saveTargets(null, form({ clientId: i.clientId })),
  () => saveMeal(form({ clientId: i.clientId, dayType: "REST", name: "x" })),
  () => deleteMeal(form({ clientId: i.clientId, id: i.mealId })),
  () => saveRecommendation(form({ clientId: i.clientId, title: "x" })),
  () => deleteRecommendation(form({ clientId: i.clientId, id: i.recommendationId })),
  () => reorderPlan(form({ clientId: i.clientId, kind: "meals", dayType: "REST", ids: [i.mealId] })),
  () => saveSpecifics(null, form({ clientId: i.clientId, planSpecifics: "x" })),
  () => saveCall(form({ clientId: i.clientId, startsAt: "2026-11-03T18:00", durationMin: "30", link: "", agenda: "" })),
  () => deleteCall(form({ clientId: i.clientId, id: i.callId })),
  () => saveCompetition(form({ clientId: i.clientId, name: "x", date: day, priority: "A", sport: "", location: "", notes: "" })),
  () => deleteCompetition(form({ clientId: i.clientId, id: i.competitionId })),
  () => saveTimeline(form({ competitionId: i.competitionId, "tasks.RACE_DAY": "x" })),
  () => saveTimelineTemplate(form({ competitionId: i.competitionId, name: "x" })),
  () => applyTimelineTemplate(form({ competitionId: i.competitionId, templateId: i.ownTemplateB })),
  () => publishFeedback(null, form({ checkInId: i.checkInId, response: "x", changes: "", newGoals: "", nextSteps: "" })),
  () => setFuelingOverride(form({ sessionId: i.sessionId, templateId: "" })),
  () => saveScheduleItem(form({ competitionId: i.competitionId, time: "10:00", type: "CARBS", title: "Gel", details: "", carbs: "", fluid: "", sodium: "", caffeine: "" })),
  () => deleteScheduleItem(form({ competitionId: i.competitionId, id: i.scheduleItemId })),
  () => duplicateScheduleItem(form({ competitionId: i.competitionId, id: i.scheduleItemId })),
  () => moveScheduleItem(form({ competitionId: i.competitionId, id: i.scheduleItemId, direction: "up" })),
  () => shiftSchedule(null, form({ competitionId: i.competitionId, minutes: "5" })),
];
const clientOrCoach = (i: Ids) => [
  () => saveSession(form({ clientId: i.clientId, date: day, startTime: "", type: "RUN", sport: "", durationMin: "30", intensity: "LOW", description: "", rpe: "", felt: "", note: "", repeatUntil: "" })),
  () => deleteSession(form({ clientId: i.clientId, id: i.sessionId })),
  () => saveBodyComp(form({ clientId: i.clientId, date: day, method: "SCALE", weightKg: "71", bodyFatPct: "", leanMassKg: "", waistCm: "", hipsCm: "", chestCm: "", thighCm: "", armCm: "", note: "" })),
  () => deleteBodyComp(form({ clientId: i.clientId, id: i.bodyCompId })),
  () => saveSupplement(form({ clientId: i.clientId, name: "x", brand: "", category: "DAILY", dose: "", timing: "", purpose: "", notes: "", activeFrom: "", activeTo: "" })),
  () => deleteSupplement(form({ clientId: i.clientId, id: i.supplementId })),
  () => saveResult(form({ clientId: i.clientId, id: i.competitionId, result: "1:00", felt: "" })),
  () => tickItem(form({ competitionId: i.competitionId, id: i.taskId, done: "true" })),
  () => tickScheduleItem(form({ competitionId: i.competitionId, id: i.scheduleItemId, done: "true" })),
  () => sendMessage(null, form({ clientId: i.clientId, text: "x" })),
  () => deleteMessage(form({ id: i.messageId })),
  () => setDayType(form({ clientId: i.clientId, date: day, dayType: "TRAINING" })),
];
const ownClientRows = (i: Ids) => [
  () => updateFluid(form({ id: i.fluidId, ml: "300", drinkType: "WATER", sodium: "", carbs: "" })),
  () => deleteFluid(form({ id: i.fluidId })),
  () => logPreset(form({ presetId: i.presetId, date: day })),
  () => deletePreset(form({ id: i.presetId })),
  () => updateEntry(form({ id: i.entryId, slot: "Oběd", grams: "100" })),
  () => deleteEntry(form({ id: i.entryId })),
  () => saveDayNote(null, form({ clientId: i.clientId, date: day, note: "x" })),
];
const ownUserRows = (i: Ids) => [
  () => deleteFood(form({ id: i.foodId })),
  () => saveFood(form({ id: i.foodId, name: "x", brand: "", kcal: "1", protein: "0", carbs: "0", fat: "0", fiber: "", sodium: "" })),
  () => openNotification(form({ id: i.notificationId })),
  () => markRead(form({ id: i.notificationId })),
];
const coachLibrary = (i: Ids) => [
  () => deleteTimelineTemplate(form({ id: i.timelineTemplateId })),
  () => deleteFuelingTemplate(form({ id: i.fuelingTemplateId })),
  () => setRecipeStatus(form({ id: i.recipeId, status: "ARCHIVED" })),
  () => duplicateRecipe(form({ id: i.recipeId })),
];
const refuseAll = async (calls: (() => Promise<unknown>)[], outcome: object) => {
  for (const call of calls) await expect(call(), String(call)).rejects.toMatchObject(outcome);
};

test("another coach can't read or change a client of someone else's, nor their library", async () => {
  const { coachA, coachB, ids } = await world();
  const before = await stateOf(ids, coachA.id);
  request.cookie = await signIn(coachB.email);
  await expect(requireCoachOf(ids.clientId)).rejects.toMatchObject(notFound); // what every coach page of the client loads through
  await expect(requireClientAccess(ids.clientId)).rejects.toMatchObject(notFound);
  await refuseAll([...coachOnly(ids), ...clientOrCoach(ids), ...ownUserRows(ids), ...coachLibrary(ids)], notFound);
  await refuseAll(ownClientRows(ids), redirectsTo("/coach"));
  await expect(copyPlan(form({ clientId: ids.clientB, sourceId: ids.clientId }))).rejects.toMatchObject(notFound); // copying their plan out
  expect(await stateOf(ids, coachA.id)).toBe(before);
});

test("another client can't read or change the client's food log, messages or anything else; a client never reaches coach notes", async () => {
  const { coachA, userA, userB, ids } = await world();
  const before = await stateOf(ids, coachA.id);
  request.cookie = await signIn(userB.email);
  await expect(requireClientAccess(ids.clientId)).rejects.toMatchObject(notFound); // the food log, the thread, …
  await refuseAll([...clientOrCoach(ids), ...ownClientRows(ids), ...ownUserRows(ids)], notFound);
  await refuseAll([...coachOnly(ids), ...coachLibrary(ids)], redirectsTo("/app"));
  // Their own client's food search doesn't find the other client's own food.
  const found = await (await searchFoodsRoute(new NextRequest("http://localhost/api/foods?q=Babiččin"))).json();
  expect(JSON.stringify(found)).not.toContain(ids.foodId);
  expect(await (await unreadRoute()).json()).toEqual({ notifications: 0, messages: 0 });

  // The client themself: coach notes are the coach's only (the notes pages sit behind requireCoach).
  request.cookie = await signIn(userA.email);
  await expect(requireCoach()).rejects.toMatchObject(redirectsTo("/app"));
  await refuseAll([() => saveNote(form({ clientId: ids.clientId, date: day, type: "NOTE", text: "x" })), () => deleteNote(form({ clientId: ids.clientId, id: ids.noteId }))], redirectsTo("/app"));
  expect(await stateOf(ids, coachA.id)).toBe(before);
});

test("an inactive client can't do anything, not even with a session from before", async () => {
  const { coachA, userA, ids } = await world();
  const before = await signIn(userA.email);
  request.cookie = await signIn(coachA.email);
  await setClientActive(form({ clientId: ids.clientId, active: "false" }));
  const state = await stateOf(ids, coachA.id);
  request.cookie = before;
  await expect(requireClientAccess(ids.clientId)).rejects.toMatchObject(redirectsTo("/login"));
  await refuseAll([...clientOrCoach(ids), ...ownClientRows(ids), ...ownUserRows(ids)], redirectsTo("/login"));
  expect((await searchFoodsRoute(new NextRequest("http://localhost/api/foods?q=Babiččin"))).status).toBe(401);
  await expect(unreadRoute()).rejects.toMatchObject(redirectsTo("/login"));
  expect(await stateOf(ids, coachA.id)).toBe(state);
});
