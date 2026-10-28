import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      <th aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined} className={`py-2 font-normal ${className}`}>
        <Link href={href({ sort: column, dir: active && params.dir === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-1 hover:text-foreground">
          {t(`Clients.columns.${column}`)}
          {active && <Arrow aria-hidden className="size-3.5" />}
        </Link>
      </th>
    );
  };

  // Active is the normal state, so only the others get a mark.
  const statusMark = (status: ClientRow["status"]) =>
    status === "ACTIVE" ? (
      <span className="text-muted-foreground">{t("Clients.statuses.ACTIVE")}</span>
    ) : (
      <span className={`inline-flex h-5 flex-none items-center rounded px-1.5 text-xs font-medium whitespace-nowrap ${status === "ONBOARDING" ? "bg-primary-soft text-primary-ink" : "bg-secondary text-secondary-foreground"}`}>
        {t(`Clients.statuses.${status}`)}
      </span>
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

      {/* The invites are share links: a right rail beside the list on wide screens, under it on narrow ones. */}
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_384px] xl:gap-6">
        <section aria-labelledby="client-list" className="xl:col-start-1 xl:row-start-1">
          <h2 id="client-list" className="sr-only">
            {t("Clients.list")}
          </h2>
          {all.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Clients.noClients")}</p>
          ) : (
            <>
              <nav aria-label={t("Clients.statusFilter")} className="flex gap-6 border-b">
                {STATUS_FILTERS.map((status) => (
                  <Link
                    key={status}
                    href={href({ status })}
                    aria-current={status === params.status ? "page" : undefined}
                    className="-mb-px flex h-10 items-center gap-1.5 border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                  >
                    {t(`Clients.tabs.${status}`)}
                    <span className="font-normal text-muted-foreground tabular-nums">{format.number(counts[status])}</span>
                  </Link>
                ))}
              </nav>
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
                      {sortHeader("mode", "hidden w-[22%] sm:table-cell")}
                      {sortHeader("status", "hidden w-[22%] sm:table-cell")}
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
                            {/* ponytail: the profile until the client dashboard lands, which takes over this link. */}
                            <Link href={`/coach/clients/${client.id}/profile`} className="truncate font-medium hover:underline">
                              {client.name}
                            </Link>
                            {client.status !== "ACTIVE" && <span className="sm:hidden">{statusMark(client.status)}</span>}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="sm:hidden">{t(`TrackingModes.${client.trackingMode as TrackingMode}`)} · </span>
                            {client.email}
                          </p>
                        </td>
                        <td className="hidden py-3 pr-4 sm:table-cell">{t(`TrackingModes.${client.trackingMode as TrackingMode}`)}</td>
                        <td className="hidden py-3 pr-4 sm:table-cell">{statusMark(client.status)}</td>
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
