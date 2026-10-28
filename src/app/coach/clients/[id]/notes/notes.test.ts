import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteNote, saveNote } from "./actions";
import ClientNotes from "./page";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("notes-coach"), name: "Notes Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("notes-client"), name: "Nora", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const notesOf = (clientId: string) => db.coachNote.findMany({ where: { clientId }, orderBy: { date: "asc" } });

test("the coach adds, edits and deletes a note; invalid input writes nothing", async () => {
  const { coach, client } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveNote(form({ clientId: client.id, date: "2026-10-01", type: "NOTE", text: "  Vstupní hovor  " }))).toBeNull();
  expect(await saveNote(form({ clientId: client.id, date: "2026-10-02", type: "DECISION", text: "Porce místo kalorií", pinned: "on" }))).toBeNull();
  const [first, second] = await notesOf(client.id);
  expect(first).toMatchObject({ date: "2026-10-01", type: "NOTE", text: "Vstupní hovor", pinned: false });
  expect(second).toMatchObject({ type: "DECISION", pinned: true });

  // A checkbox left unticked sends nothing: unpinned.
  expect(await saveNote(form({ clientId: client.id, id: second.id, date: "2026-10-03", type: "DECISION", text: "Porce, zhodnotit za 2 týdny" }))).toBeNull();
  expect(await db.coachNote.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({ date: "2026-10-03", text: "Porce, zhodnotit za 2 týdny", pinned: false });

  expect(await saveNote(form({ clientId: client.id, date: "2026-02-30", type: "IDEA", text: " " }))).toEqual({ invalid: ["date", "type", "text"] });
  expect(await saveNote(form({ clientId: client.id, date: "2026-10-01", type: "NOTE", text: "x".repeat(5001) }))).toEqual({ invalid: ["text"] });
  await deleteNote(form({ clientId: client.id, id: first.id }));
  expect((await notesOf(client.id)).map((n) => n.id)).toEqual([second.id]);
});

test("another coach can't add, edit, delete or read a client's notes, not even through their own client", async () => {
  const { client } = await setup();
  const other = await setup();
  const note = await db.coachNote.create({ data: { clientId: client.id, date: "2026-10-01", type: "NOTE", text: "Soukromé" } });
  request.cookie = await signIn(other.coach.email);
  const fields = { date: "2026-10-01", type: "NOTE", text: "Přepsáno" };
  await expect(saveNote(form({ clientId: client.id, ...fields }))).rejects.toMatchObject(notFound);
  await expect(saveNote(form({ clientId: client.id, id: note.id, ...fields }))).rejects.toMatchObject(notFound);
  await expect(deleteNote(form({ clientId: client.id, id: note.id }))).rejects.toMatchObject(notFound);
  // The other coach's own client id with this note's id: the note isn't theirs.
  await expect(saveNote(form({ clientId: other.client.id, id: note.id, ...fields }))).rejects.toMatchObject(notFound);
  await expect(deleteNote(form({ clientId: other.client.id, id: note.id }))).rejects.toMatchObject(notFound);
  await expect(ClientNotes({ params: Promise.resolve({ id: client.id }), searchParams: Promise.resolve({}) })).rejects.toMatchObject(notFound);
  expect(await db.coachNote.findUniqueOrThrow({ where: { id: note.id } })).toMatchObject({ text: "Soukromé" });
});

test("a client can't reach their notes: the actions and the notes page refuse, and no client page loads notes", async () => {
  const { user, client } = await setup();
  const note = await db.coachNote.create({ data: { clientId: client.id, date: "2026-10-01", type: "NOTE", text: "Soukromé" } });
  request.cookie = await signIn(user.email);
  await expect(saveNote(form({ clientId: client.id, date: "2026-10-01", type: "NOTE", text: "x" }))).rejects.toMatchObject(redirectsTo("/app"));
  await expect(deleteNote(form({ clientId: client.id, id: note.id }))).rejects.toMatchObject(redirectsTo("/app"));
  await expect(ClientNotes({ params: Promise.resolve({ id: client.id }), searchParams: Promise.resolve({}) })).rejects.toMatchObject(redirectsTo("/app"));
  request.cookie = "";
  await expect(saveNote(form({ clientId: client.id, date: "2026-10-01", type: "NOTE", text: "x" }))).rejects.toMatchObject(redirectsTo("/login"));

  // Notes are read only under /coach: no route a client can open touches the table.
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  const outsideCoach = files("src/app").filter((f) => !f.startsWith(join("src/app", "coach")) && !f.endsWith(".test.ts"));
  expect(outsideCoach.length).toBeGreaterThan(10);
  expect(outsideCoach.filter((f) => readFileSync(f, "utf8").includes("coachNote"))).toEqual([]);
});
