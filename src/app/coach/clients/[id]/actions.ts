"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { type HistoryPayloads, TRACKING_MODES, type TrackingMode } from "@/lib/enums";

// The coach switches the client's tracking mode and the change goes into the history. Nothing is deleted: each mode's
// logs stay and show again when the mode comes back.
export async function changeTrackingMode(form: FormData) {
  const { clientId, trackingMode } = z.object({ clientId: z.string(), trackingMode: z.enum(TRACKING_MODES) }).parse(Object.fromEntries(form));
  const { client } = await requireCoachOf(clientId);
  const { timezone } = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  const payload: HistoryPayloads["TRACKING_MODE"] = { from: client.trackingMode as TrackingMode, to: trackingMode };
  await db.$transaction(async (tx) => {
    // Only from the mode just read, so a concurrent change can't be recorded with the wrong "from".
    const { count } = await tx.client.updateMany({ where: { id: client.id, trackingMode: payload.from, NOT: { trackingMode } }, data: { trackingMode } });
    if (count) await tx.historyEvent.create({ data: { clientId: client.id, type: "TRACKING_MODE", date: todayIn(timezone), payload } });
  });
  revalidatePath(`/coach/clients/${client.id}`, "layout");
}
