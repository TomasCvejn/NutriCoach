import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { findByBarcode, searchFoods } from "@/lib/food-search";

const params = z.union([z.object({ q: z.string().trim().min(2).max(100) }), z.object({ ean: z.string().regex(/^\d{8,14}$/) })]);

// GET /api/foods?q=… or ?ean=… — the food search for the signed-in user (their visible foods + Open Food Facts).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user.active) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { id, role, locale } = session.user;
  const viewer =
    role === "COACH"
      ? ({ role: "COACH", id } as const)
      : ({ role: "CLIENT", id, coachId: (await db.client.findUniqueOrThrow({ where: { userId: id }, select: { coachId: true } })).coachId } as const);
  return Response.json("q" in parsed.data ? await searchFoods(viewer, parsed.data.q, locale) : await findByBarcode(viewer, parsed.data.ean, locale));
}
