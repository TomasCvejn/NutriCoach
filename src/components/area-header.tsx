import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

// Top bar of both signed-in areas.
export async function AreaHeader({ home, userName }: { home: "/coach" | "/app"; userName: string }) {
  const t = await getTranslations("Shell");
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b px-4 sm:px-[29px]">
      <div className="flex items-center gap-6">
        <Link href={home}>
          <Logo />
        </Link>
        {/* ponytail: the one coach page so far; the app shell item replaces this with the sidebar. */}
        {home === "/coach" && (
          <Link href="/coach/clients" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("clients")}
          </Link>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-4">
        <span className="truncate text-sm text-muted-foreground">{userName}</span>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            {t("logout")}
          </Button>
        </form>
      </div>
    </header>
  );
}
