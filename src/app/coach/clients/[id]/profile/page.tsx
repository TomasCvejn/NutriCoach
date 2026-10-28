import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/app/app/profile/profile-form";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TrackingMode } from "@/lib/enums";

// The coach views and edits their client's profile (linked from Overview): the client's own form, under the client's header.
export default async function ClientProfilePage({ params }: PageProps<"/coach/clients/[id]/profile">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, { name }] = await Promise.all([getTranslations(), db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { name: true } })]);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {t("Profile.coachLead")}
        {/* The client's wish from onboarding; the mode itself is the coach's call. */}
        {client.preferredTrackingMode && ` ${t("Profile.preferredMode", { mode: t(`TrackingModes.${client.preferredTrackingMode as TrackingMode}`) })}.`}
      </p>
      <ProfileForm profile={{ ...client, name }} />
    </div>
  );
}
