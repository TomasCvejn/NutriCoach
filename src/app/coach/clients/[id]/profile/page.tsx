import { ChevronLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ProfileForm } from "@/app/app/profile/profile-form";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";

// The coach views and edits their client's profile: the client's own form.
export default async function ClientProfilePage({ params }: PageProps<"/coach/clients/[id]/profile">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, { name }] = await Promise.all([getTranslations(), db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { name: true } })]);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link href="/coach/clients" className="-ml-1 inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("Nav.clients")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Profile.coachLead")}</p>
      </header>
      <ProfileForm profile={{ ...client, name }} />
    </div>
  );
}
