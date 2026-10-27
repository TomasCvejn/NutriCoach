"use client";

import { useSyncExternalStore } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Preselects the browser's zone once hydrated (the server can't know it); falls back when the server doesn't list it.
export function TimezoneSelect({ zones, fallback, ...props }: { zones: string[]; fallback: string; id: string; name: string; "aria-describedby": string }) {
  const browser = useSyncExternalStore(subscribe, browserZone, () => null);
  const initial = browser && zones.includes(browser) ? browser : fallback;
  return (
    <NativeSelect key={initial} defaultValue={initial} className="w-full" {...props}>
      {zones.map((zone) => (
        <NativeSelectOption key={zone} value={zone}>
          {zone.replaceAll("_", " ")}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
