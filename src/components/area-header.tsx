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
      <Link href={home}>
        <Logo />
      </Link>
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
