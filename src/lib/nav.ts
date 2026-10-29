import type { clientFeatures } from "./features";

export type NavItem = { key: "overview" | "clients" | "library" | "today" | "nutrition" | "training" | "plan" | "recipes" | "hydration" | "checkIn" | "checkIns" | "progress" | "profile" | "settings"; href: string };
// Phone: the tabs in the bottom bar (at most 4, plus "More") and the rest in the "More" sheet. Desktop: all of them in the sidebar.
export type Nav = { tabs: NavItem[]; more: NavItem[] };

// Each entry appears when its page lands. Final: Overview, Clients, Check-ins, Messages | Calendar, Library, Settings.
export const coachNav: Nav = {
  tabs: [
    { key: "overview", href: "/coach" },
    { key: "clients", href: "/coach/clients" },
    { key: "checkIns", href: "/coach/check-ins" },
  ],
  more: [
    { key: "library", href: "/coach/library" },
    { key: "settings", href: "/coach/settings" },
  ],
};

// Final tabs: Today · Nutrition · Training (only when the client trains) · Messages; everything else under "More".
// Nutrition, Messages and the "More" entries appear when their pages land.
export function clientNav(features: ReturnType<typeof clientFeatures>): Nav {
  const tabs: NavItem[] = [
    { key: "today", href: "/app" },
    { key: "nutrition", href: "/app/nutrition" },
  ];
  if (features.training) tabs.push({ key: "training", href: "/app/training" });
  return {
    tabs,
    more: [
      { key: "plan", href: "/app/plan" },
      { key: "recipes", href: "/app/recipes" },
      { key: "hydration", href: "/app/hydration" },
      { key: "progress", href: "/app/progress" },
      { key: "checkIn", href: "/app/check-in" },
      { key: "profile", href: "/app/profile" },
      { key: "settings", href: "/app/settings" },
    ],
  };
}
