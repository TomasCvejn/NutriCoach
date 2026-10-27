import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { pendingInvite, requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeInvite } from "./actions";
import { CopyLinkButton, InviteDialog } from "./invite-dialog";

// The coach's clients and pending invites. Search, filters, sorting and status land with the client list item.
export default async function ClientsPage() {
  const coach = await requireCoach();
  const [t, format, clients, invites] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.client.findMany({ where: { coachId: coach.id }, include: { user: { select: { name: true, email: true } } }, orderBy: { user: { name: "asc" } } }),
    db.invite.findMany({ where: { coachId: coach.id, ...pendingInvite() }, orderBy: { createdAt: "desc" } }),
  ]);
  const choice = (value: string | null, group: "Programs" | "TrackingModes") => (value ? t(`${group}.${value}`) : t("Clients.clientChooses"));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Clients.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Clients.summary", { clients: clients.length, invites: invites.length })}</p>
        </div>
        <InviteDialog />
      </div>

      {/* The invites are share links: a right rail beside the list on wide screens, above it on narrow ones. */}
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_384px] xl:gap-6">
        <section aria-labelledby="pending-invites" className="xl:col-start-2 xl:row-start-1">
          <h2 id="pending-invites" className="text-lg font-semibold">
            {t("Clients.invites")}
          </h2>
          {invites.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Clients.noInvites")}</p>
          ) : (
            <ul className="mt-2">
              {invites.map((invite) => (
                <li key={invite.id} className="border-b border-rule py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="truncate text-sm font-medium">{invite.name}</p>
                    <p className="flex-none text-xs text-muted-foreground tabular-nums">
                      {t("Clients.expires", { date: format.dateTime(invite.expiresAt, { dateStyle: "medium" }) })}
                    </p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{invite.email ?? t("Clients.anyEmail")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("Clients.inviteSetup", { program: choice(invite.program, "Programs"), mode: choice(invite.trackingMode, "TrackingModes") })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <CopyLinkButton token={invite.token} />
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={invite.id} />
                      <Button type="submit" variant="ghost" aria-label={t("Clients.revokeFor", { name: invite.name })}>
                        {t("Clients.revoke")}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="client-list" className="xl:col-start-1 xl:row-start-1">
          <h2 id="client-list" className="text-lg font-semibold">
            {t("Clients.list")}
          </h2>
          {clients.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Clients.noClients")}</p>
          ) : (
            <table className="mt-2 w-full table-fixed text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 font-normal">{t("Clients.columns.name")}</th>
                  <th className="w-[28%] py-2 font-normal">{t("Clients.columns.program")}</th>
                  <th className="w-[28%] py-2 font-normal">{t("Clients.columns.mode")}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-rule">
                    <td className="py-3 pr-4">
                      <p className="truncate font-medium">{client.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.user.email}</p>
                    </td>
                    <td className="py-3 pr-4">{t(`Programs.${client.program}`)}</td>
                    <td className="py-3">{t(`TrackingModes.${client.trackingMode}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
