import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

// The client's own profile; the coach edits the same form at /coach/clients/[id]/profile.
export default async function ProfilePage() {
  const { user, client } = await requireClient();
  const t = await getTranslations("Profile");
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      <ProfileForm profile={{ ...client, name: user.name }} />
    </div>
  );
}
