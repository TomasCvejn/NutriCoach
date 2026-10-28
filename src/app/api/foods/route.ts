import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { findByBarcode, fromFood, recentFoods, searchFoods } from "@/lib/food-search";

const params = z.union([z.object({ q: z.string().trim().min(2).max(100) }), z.object({ ean: z.string().regex(/^\d{8,14}$/) }), z.object({}).strict()]);

// GET /api/foods?q=… or ?ean=… — the food search for the signed-in user (their visible foods + Open Food Facts);
// without either, a client's recently logged foods.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user.active) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { id, role, locale } = session.user;
  const client = role === "CLIENT" ? await db.client.findUniqueOrThrow({ where: { userId: id }, select: { id: true, coachId: true } }) : null;
  const viewer = client ? ({ role: "CLIENT", id, coachId: client.coachId } as const) : ({ role: "COACH", id } as const);
  const recent = client ? await recentFoods(client.id) : [];
  if ("q" in parsed.data) return Response.json(await searchFoods(viewer, parsed.data.q, locale, recent.map((f) => f.id)));
  if ("ean" in parsed.data) return Response.json(await findByBarcode(viewer, parsed.data.ean, locale));
  return Response.json({ results: recent.map(fromFood), offUnavailable: false });
}
