import type { ReactNode } from "react";

// A status mark inside a row or beside a value: a pale tint with dark text of the same hue.
const TONES = {
  neutral: "bg-secondary text-secondary-foreground",
  accent: "bg-primary-soft text-primary-ink",
  warning: "bg-warning-soft text-warning",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex h-5 flex-none items-center rounded px-1.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}
