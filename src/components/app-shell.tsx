"use client";

import { ActivityIcon, BellIcon, ChefHatIcon, ClipboardCheckIcon, ClipboardListIcon, DropletIcon, EllipsisIcon, HouseIcon, LibraryBigIcon, type LucideIcon, SettingsIcon, SunIcon, UserRoundIcon, UsersIcon, UtensilsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Nav, NavItem } from "@/lib/nav";
import { Logo } from "./logo";

const ICONS: Record<NavItem["key"], LucideIcon> = {
  overview: HouseIcon,
  clients: UsersIcon,
  library: LibraryBigIcon,
  today: SunIcon,
  nutrition: UtensilsIcon,
  training: ActivityIcon,
  plan: ClipboardListIcon,
  recipes: ChefHatIcon,
  hydration: DropletIcon,
  checkIn: ClipboardCheckIcon,
  profile: UserRoundIcon,
  settings: SettingsIcon,
};

type User = { name: string; email: string };

// Both signed-in areas. Desktop (lg+): a 230px sidebar on the page ground with every entry, no top bar (nothing real to put in one).
// Phone and tablet: a top bar with the mark, the tabs in a bottom bar, the rest and the account in the "More" sheet.
// The notification bell sits beside the mark in both (sidebar top, phone top bar).
// Accent ladder: the active row is a pale tint with the hue's dark ink, only its icon takes the full hue
// (primary-track, because primary-soft disappears on the page ground).
export function AppShell({ nav, user, unread, children }: { nav: Nav; user: User; unread: number; children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const home = nav.tabs[0].href;
  // The area home matches only itself; every other entry also owns its subpages.
  const isActive = (href: string) => pathname === href || (href !== home && pathname.startsWith(`${href}/`));

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-[230px] flex-none flex-col border-r lg:flex">
        <div className="flex h-16 flex-none items-center justify-between pr-3 pl-5">
          <Link href={home}>
            <Logo />
          </Link>
          <Bell href={`${home}/notifications`} unread={unread} active={isActive(`${home}/notifications`)} />
        </div>
        <nav aria-label={t("Shell.nav")} className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-0.5">
            {[...nav.tabs, ...nav.more].map(({ key, href }) => {
              const Icon = ICONS[key];
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className="group flex h-10 items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-primary-track/60 aria-[current=page]:font-medium aria-[current=page]:text-primary-ink"
                  >
                    <Icon className="size-4 group-aria-[current=page]:text-primary" aria-hidden />
                    {t(`Nav.${key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex-none border-t px-5 py-4">
          <Account user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b pr-2 pl-4 lg:hidden">
          <Link href={home}>
            <Logo />
          </Link>
          <Bell href={`${home}/notifications`} unread={unread} active={isActive(`${home}/notifications`)} />
        </header>
        <main className="flex-1 px-4 pt-6 pb-28 sm:px-[29px] sm:pt-9 lg:pb-9">{children}</main>
      </div>

      <nav aria-label={t("Shell.nav")} className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid auto-cols-fr grid-flow-col">
          {nav.tabs.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} aria-current={isActive(href) ? "page" : undefined} data-active={isActive(href) || undefined} className={TAB}>
                <TabIcon icon={ICONS[key]} />
                {t(`Nav.${key}`)}
              </Link>
            </li>
          ))}
          <li>
            <More items={nav.more} user={user} active={nav.more.some((item) => isActive(item.href))} isActive={isActive} />
          </li>
        </ul>
      </nav>
    </div>
  );
}

// The unread count is a small mark, so it takes the full hue; no badge at zero.
function Bell({ href, unread, active }: { href: string; unread: number; active: boolean }) {
  const t = useTranslations("Notifications");
  return (
    <Link
      href={href}
      aria-label={t("bell", { count: unread })}
      aria-current={active ? "page" : undefined}
      className="relative flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-primary-track/60 aria-[current=page]:text-primary"
    >
      <BellIcon className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[11px] leading-4 font-medium text-primary-foreground tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

const TAB =
  "group flex h-16 w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground data-active:font-medium data-active:text-primary-ink";

function TabIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-7 w-12 items-center justify-center rounded-full group-data-active:bg-primary-track/60">
      <Icon className="size-5 group-data-active:text-primary" aria-hidden />
    </span>
  );
}

function More({ items, user, active, isActive }: { items: NavItem[]; user: User; active: boolean; isActive: (href: string) => boolean }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger data-active={active || undefined} className={TAB}>
        <TabIcon icon={EllipsisIcon} />
        {t("Shell.more")}
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0 rounded-t-xl pb-[env(safe-area-inset-bottom)] shadow-none">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="text-lg font-semibold">{t("Shell.more")}</SheetTitle>
        </SheetHeader>
        {items.length > 0 && (
          <ul className="px-3">
            {items.map(({ key, href }) => {
              const Icon = ICONS[key];
              return (
                <li key={key}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className="group flex h-12 items-center gap-3 rounded-md px-3 text-sm aria-[current=page]:bg-primary-track/60 aria-[current=page]:font-medium aria-[current=page]:text-primary-ink"
                  >
                    <Icon className="size-5 text-muted-foreground group-aria-[current=page]:text-primary" aria-hidden />
                    {t(`Nav.${key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2 border-t px-5 pt-4 pb-6">
          <Account user={user} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Account({ user }: { user: User }) {
  const t = useTranslations("Shell");
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-9 w-full">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
