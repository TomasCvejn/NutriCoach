import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { Button } from "@/components/ui/button";
import { UnderlineTabs } from "@/components/underline-tabs";
import { pendingInvite, requireCoach } from "@/lib/auth";
import { type ClientRow, clientList, coachClients, type ListParams, listParams, type SORT_COLUMNS, STATUS_FILTERS } from "@/lib/client-list";
import { db } from "@/lib/db";
import type { TrackingMode } from "@/lib/enums";
import { revokeInvite, setClientActive } from "./actions";
import { CopyLinkButton, InviteDialog } from "./invite-dialog";
import { ClearFilters, ClientFilters, DeactivateButton } from "./list-controls";

// The coach's clients (status tabs, search, mode filter, sortable columns; the view lives in the URL) and pending invites.
export default async function ClientsPage({ searchParams }: PageProps<"/coach/clients">) {
  const coach = await requireCoach();
  const params = listParams.parse(await searchParams);
  const [t, format, locale, all, invites] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getLocale(),
    coachClients(),
    db.invite.findMany({ where: { coachId: coach.id, ...pendingInvite() }, orderBy: { createdAt: "desc" } }),
  ]);
  const { rows, counts } = clientList(all, params, locale);

  // This view with some params changed; empty ones are left out of the URL.
  const href = (change: Partial<ListParams>) =>
    `/coach/clients?${new URLSearchParams(Object.entries({ ...params, ...change }).filter((e): e is [string, string] => Boolean(e[1])))}`;

  const sortHeader = (column: (typeof SORT_COLUMNS)[number], className = "") => {
    const active = params.sort === column;
    const Arrow = params.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
    return (
      <th aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined} className={`py-2 pr-4 font-normal last:pr-0 ${className}`}>
        <Link href={href({ sort: column, dir: active && params.dir === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-1 hover:text-foreground">
          {t(`Clients.columns.${column}`)}
          {active && <Arrow aria-hidden className="size-3.5" />}
        </Link>
      </th>
    );
  };

  // The last day anything of the client's current mode was logged, in the client's days; a dash when never.
  const lastLogged = (client: ClientRow) =>
    client.daysAgo == null ? "—" : client.daysAgo <= 1 ? t(client.daysAgo === 0 ? "Clients.today" : "Clients.yesterday") : t("Clients.daysAgo", { count: client.daysAgo });
  const adherence = (client: ClientRow) => (client.adherence == null ? "—" : format.number(client.adherence / 100, { style: "percent" }));

  // Active is the normal state, so only the others get a mark.
  const statusMark = (status: ClientRow["status"]) =>
    status === "ACTIVE" ? (
      <span className="text-muted-foreground">{t("Clients.statuses.ACTIVE")}</span>
    ) : (
      <Pill tone={status === "ONBOARDING" ? "accent" : "neutral"}>{t(`Clients.statuses.${status}`)}</Pill>
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Clients.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Clients.summary", { clients: all.filter((c) => c.status !== "INACTIVE").length, invites: invites.length })}</p>
        </div>
        <InviteDialog />
      </div>

      {/* The list takes the full width (its columns need it); the invites, share links, follow it. */}
      <div className="flex flex-col gap-10">
        <section aria-labelledby="client-list">
          <h2 id="client-list" className="sr-only">
            {t("Clients.list")}
          </h2>
          {all.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Clients.noClients")}</p>
          ) : (
            <>
              <UnderlineTabs
                label={t("Clients.statusFilter")}
                tabs={STATUS_FILTERS.map((status) => ({
                  href: href({ status }),
                  current: status === params.status,
                  label: (
                    <>
                      {t(`Clients.tabs.${status}`)}
                      <span className="font-normal text-muted-foreground tabular-nums">{format.number(counts[status])}</span>
                    </>
                  ),
                }))}
              />
              <div className="mt-6">
                <ClientFilters params={params} />
              </div>
              {rows.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  {params.q || params.mode ? (
                    <>
                      {t("Clients.noMatch")}{" "}
                      <ClearFilters />
                    </>
                  ) : (
                    t(`Clients.empty.${params.status}`)
                  )}
                </p>
              ) : (
                <table className="mt-4 w-full table-fixed text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      {sortHeader("name")}
                      {sortHeader("mode", "hidden w-28 sm:table-cell")}
                      {sortHeader("status", "hidden w-40 lg:table-cell")}
                      {sortHeader("lastLogged", "hidden w-32 md:table-cell")}
                      {sortHeader("adherence", "hidden w-28 text-right md:table-cell")}
                      <th className="w-28">
                        <span className="sr-only">{t("Clients.columns.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((client) => (
                      <tr key={client.id} className="border-t border-rule">
                        <td className="py-3 pr-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <Link href={`/coach/clients/${client.id}`} className="truncate font-medium hover:underline">
                              {client.name}
                            </Link>
                            {client.status !== "ACTIVE" && <span className="lg:hidden">{statusMark(client.status)}</span>}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="sm:hidden">{t(`TrackingModes.${client.trackingMode as TrackingMode}`)} · </span>
                            <span className="md:hidden">{t("Clients.summaryLine", { last: lastLogged(client), adherence: adherence(client) })} · </span>
                            {client.email}
                          </p>
                        </td>
                        <td className="hidden py-3 pr-4 sm:table-cell">{t(`TrackingModes.${client.trackingMode as TrackingMode}`)}</td>
                        <td className="hidden py-3 pr-4 lg:table-cell">{statusMark(client.status)}</td>
                        <td className="hidden py-3 pr-4 text-muted-foreground md:table-cell" title={client.lastLogged ?? undefined}>
                          {lastLogged(client)}
                        </td>
                        <td className="hidden py-3 pr-4 text-right tabular-nums md:table-cell">{adherence(client)}</td>
                        <td className="py-3 text-right">
                          {client.status === "INACTIVE" ? (
                            <form action={setClientActive}>
                              <input type="hidden" name="clientId" value={client.id} />
                              <input type="hidden" name="active" value="true" />
                              <Button type="submit" variant="outline" className="h-10 sm:h-8" aria-label={t("Clients.reactivateFor", { name: client.name })}>
                                {t("Clients.reactivate")}
                              </Button>
                            </form>
                          ) : (
                            <DeactivateButton clientId={client.id} name={client.name} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="pending-invites" className="max-w-3xl">
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
                    {t("Clients.inviteSetup", { mode: invite.trackingMode ? t(`TrackingModes.${invite.trackingMode}`) : t("Clients.clientChooses") })}
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
      </div>
    </div>
  );
}
