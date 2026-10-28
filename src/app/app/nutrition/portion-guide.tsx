import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { TARGET_FIELDS } from "@/lib/nutrition";

// Each hand portion drawn in the palette: the hand in the pale tint, outlined in the hue's dark ink.
const HANDS: Record<(typeof TARGET_FIELDS.PORTIONS)[number], ReactNode> = {
  // An open palm, fingers together.
  palms: (
    <path d="M13 35V10.5a2 2 0 0 1 4 0V19V7.5a2 2 0 0 1 4 0V19V6.5a2 2 0 0 1 4 0V19V8.5a2 2 0 0 1 4 0V24l2.6-3.4a2 2 0 0 1 3.2 2.4L28.5 32a7 7 0 0 1-5.7 3Z" />
  ),
  // A hand cupped like a bowl, seen from the side.
  hands: <path d="M5 17h30a2 2 0 0 1 2 2.2C36.2 28 29 34 20 34S3.8 28 3 19.2A2 2 0 0 1 5 17Zm2-4.5a2.5 2.5 0 0 1 5 0V17H7Z" />,
  // A closed fist with its knuckles.
  fists: (
    <>
      <path d="M9 14a3 3 0 0 1 3-3h17a3 3 0 0 1 3 3v12a9 9 0 0 1-9 9h-5a9 9 0 0 1-9-9Z" />
      <path d="M15.5 11v7M21 11v7M26.5 11v7M9 22h9" fill="none" />
    </>
  ),
  // A thumb seen from the side, tip to the right, nail and joint marked: the whole thumb is one portion.
  thumbs: (
    <>
      <path d="M5 15.5h21a8 8 0 0 1 0 16H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z" />
      <path d="M24 18.5h3.5a4 4 0 0 1 0 8H24ZM16 16v15" fill="none" />
    </>
  ),
};

// "How to count portions": what each hand portion means, folded away until needed (PORTIONS day).
export async function PortionGuide() {
  const t = await getTranslations("Portions.guide");
  return (
    <details className="rounded-lg border bg-card p-5 text-sm">
      <summary className="cursor-pointer font-semibold">{t("title")}</summary>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {TARGET_FIELDS.PORTIONS.map((kind) => (
          <li key={kind} className="flex gap-3">
            <svg viewBox="0 0 40 40" aria-hidden className="size-10 flex-none fill-primary-track stroke-primary-ink" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
              {HANDS[kind]}
            </svg>
            <span>
              <span className="font-medium">{t(`${kind}.title`)}</span>
              <span className="block text-muted-foreground">{t(`${kind}.text`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
