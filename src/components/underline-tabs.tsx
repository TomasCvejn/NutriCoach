import Link from "next/link";
import type { ReactNode } from "react";

// Tabs as links on one full-width rule; the current one gets the ink underline.
export function UnderlineTabs({ label, tabs }: { label: string; tabs: { href: string; label: ReactNode; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex gap-6 overflow-x-auto border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? "page" : undefined}
          className="-mb-px flex h-10 flex-none items-center gap-1.5 border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
