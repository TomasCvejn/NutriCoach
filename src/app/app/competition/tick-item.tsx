"use client";

import { useOptimistic, useTransition } from "react";
import type { Item } from "@/lib/timeline";
import { tickItem } from "./actions";

// One task or packing item the client ticks off; the tick shows at once and is saved behind it.
export function TickItem({ competitionId, item }: { competitionId: string; item: Item }) {
  const [done, setDone] = useOptimistic(item.done);
  const [, start] = useTransition();
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5 text-sm">
      <input
        type="checkbox"
        checked={done}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setDone(next);
            const form = new FormData();
            form.set("competitionId", competitionId);
            form.set("id", item.id);
            form.set("done", String(next));
            await tickItem(form);
          });
        }}
        className="mt-0.5 size-5 flex-none accent-primary"
      />
      <span className={done ? "text-muted-foreground line-through" : ""}>{item.text}</span>
    </label>
  );
}
