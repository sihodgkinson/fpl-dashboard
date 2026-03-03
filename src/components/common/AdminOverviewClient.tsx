"use client";

import * as React from "react";
import useSWR from "swr";
import {
  ArrowRightLeft,
  CircleGauge,
  Database,
  Dices,
  TableOfContents,
} from "lucide-react";
import { AppShell, useAppShellNavigation } from "@/components/common/AppShell";
import type { AppSidebarSection } from "@/components/common/AppSidebar";
import { DashboardTabRow, type DashboardTabOption } from "@/components/common/DashboardTabRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card";
import { DashboardStatCard, DashboardStatGrid } from "@/components/common/DashboardStatCard";
import { DashboardTableCard } from "@/components/common/DashboardTableCard";

interface AdminOverviewResponse {
  users: number;
  uniqueTrackedLeagues: number;
  cacheRows: number;
  totalRows: number;
  usersTable: {
    id: string;
    name: string | null;
    email: string | null;
    authMethod: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    linkedLeagues: number;
    linkedLeagueDetails: Array<{
      leagueId: number;
      leagueName: string | null;
    }>;
  }[];
  leaguesTable: {
    leagueId: number;
    leagueName: string | null;
    linkedUsers: number;
    linkedRows: number;
    createdAt: string | null;
    linkedUserDetails: Array<{
      id: string;
      name: string | null;
      email: string | null;
    }>;
  }[];
  rowsBySource: {
    tableName: string;
    rows: number;
    source: "public" | "auth";
  }[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return (await res.json()) as AdminOverviewResponse;
};

function formatCount(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "--";
  return new Intl.NumberFormat("en-GB").format(value as number);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

export function AdminOverviewClient() {
  const { useDrawerNav, mobileSidebarOpen, setMobileSidebarOpen } = useAppShellNavigation();
  const [activeTab, setActiveTab] = React.useState<"users" | "leagues" | "tables">("users");

  const { data, error, isLoading } = useSWR<AdminOverviewResponse>("/api/admin/overview", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  const tabOptions = React.useMemo<DashboardTabOption[]>(
    () => [
      { value: "users", label: "Users" },
      { value: "leagues", label: "Leagues" },
      { value: "tables", label: "Tables" },
    ],
    []
  );

  const sidebarSections: AppSidebarSection[] = [
    {
      key: "leagueiq",
      label: "LeagueIQ",
      items: [
        {
          key: "tables",
          label: "Tables",
          href: "/dashboard/leagueiq/tables",
          icon: TableOfContents,
          active: false,
          placeholder: false,
        },
        {
          key: "transfers",
          label: "Transfers",
          href: "#",
          icon: ArrowRightLeft,
          active: false,
          placeholder: true,
        },
        {
          key: "chips",
          label: "Chips",
          href: "#",
          icon: Dices,
          active: false,
          placeholder: true,
        },
      ],
    },
  ];

  return (
    <AppShell
      title="Admin Console"
      sections={sidebarSections}
      footerItem={{
        key: "admin-console",
        label: "Admin Console",
        href: "/dashboard/admin",
        icon: CircleGauge,
        active: true,
        placeholder: false,
      }}
      useDrawerNav={useDrawerNav}
      mobileSidebarOpen={mobileSidebarOpen}
      onMobileSidebarOpenChange={setMobileSidebarOpen}
      headerRight={
        <div className="inline-flex h-8 items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Database className="h-3.5 w-3.5" />
          <span>Read-only</span>
        </div>
      }
    >
      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          Failed to load admin overview data.
        </div>
      ) : null}

      <DashboardStatGrid>
        <DashboardStatCard
          label="Users"
          value={formatCount(data?.users)}
          loading={isLoading}
        />
        <DashboardStatCard
          label="Leagues"
          value={formatCount(data?.uniqueTrackedLeagues)}
          loading={isLoading}
        />
        <DashboardStatCard
          label="Cache Rows"
          value={formatCount(data?.cacheRows)}
          loading={isLoading}
        />
        <DashboardStatCard
          label="Total Rows"
          value={formatCount(data?.totalRows)}
          loading={isLoading}
        />
      </DashboardStatGrid>

      <DashboardTabRow
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "users" | "leagues" | "tables")}
        options={tabOptions}
        touchMode={useDrawerNav}
      />

      <DashboardTableCard loading={isLoading}>
        {!isLoading ? (
            <Table>
              {activeTab === "users" ? (
                <>
                  <TableHeader className="bg-background [&_th]:font-semibold">
                    <TableRow className="text-foreground hover:bg-transparent">
                      <TableHead className="admin-users-combined-col sm:hidden">Name / Email</TableHead>
                      <TableHead className="admin-users-split-col hidden sm:table-cell">Name</TableHead>
                      <TableHead className="admin-users-split-col hidden sm:table-cell">Email</TableHead>
                      <TableHead className="admin-users-split-col hidden sm:table-cell">Auth</TableHead>
                      <TableHead className="text-center">Leagues</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Created</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Last Sign-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.usersTable?.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="admin-users-combined-col sm:hidden">
                          <div>{row.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.email ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="admin-users-split-col hidden sm:table-cell">{row.name ?? "—"}</TableCell>
                        <TableCell className="admin-users-split-col hidden text-xs sm:table-cell sm:text-sm">
                          {row.email ?? "—"}
                        </TableCell>
                        <TableCell className="admin-users-split-col hidden sm:table-cell">{row.authMethod ?? "—"}</TableCell>
                        <TableCell className="text-center font-mono">
                          {row.linkedLeagues > 0 ? (
                            <ResponsiveInfoCard
                              trigger={
                                <button className="cursor-pointer underline decoration-dotted">
                                  {formatCount(row.linkedLeagues)}
                                </button>
                              }
                              content={
                                <ul className="space-y-1 text-sm">
                                  {row.linkedLeagueDetails.map((league) => (
                                    <li
                                      key={`${row.id}-${league.leagueId}`}
                                      className="flex items-center justify-between gap-4"
                                    >
                                      <span className="text-muted-foreground">
                                        {league.leagueName ?? `League ${league.leagueId}`}
                                      </span>
                                      <span className="font-mono text-right">{league.leagueId}</span>
                                    </li>
                                  ))}
                                </ul>
                              }
                              className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                            />
                          ) : (
                            <span>{formatCount(row.linkedLeagues)}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right font-mono md:table-cell">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="hidden text-right font-mono md:table-cell">
                          {formatDate(row.lastSignInAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : null}

              {activeTab === "leagues" ? (
                <>
                  <TableHeader className="bg-background [&_th]:font-semibold">
                    <TableRow className="text-foreground hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">League Id</TableHead>
                      <TableHead className="text-center">Users</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.leaguesTable?.map((row) => (
                      <TableRow key={row.leagueId}>
                        <TableCell>
                          {row.leagueName ?? `League ${row.leagueId}`}
                        </TableCell>
                        <TableCell className="text-right font-mono">{row.leagueId}</TableCell>
                        <TableCell className="text-center font-mono">
                          {row.linkedUsers > 0 ? (
                            <ResponsiveInfoCard
                              trigger={
                                <button className="cursor-pointer underline decoration-dotted">
                                  {formatCount(row.linkedUsers)}
                                </button>
                              }
                              content={
                                <ul className="space-y-1 text-sm">
                                  {row.linkedUserDetails.map((user) => (
                                    <li
                                      key={`${row.leagueId}-${user.id}`}
                                      className="text-muted-foreground"
                                    >
                                      {user.email ?? user.id}
                                    </li>
                                  ))}
                                </ul>
                              }
                              className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                            />
                          ) : (
                            <span>{formatCount(row.linkedUsers)}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right font-mono sm:table-cell">
                          {formatDate(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : null}

              {activeTab === "tables" ? (
                <>
                  <TableHeader className="bg-background [&_th]:font-semibold">
                    <TableRow className="text-foreground hover:bg-transparent">
                      <TableHead className="w-[45%]">Table</TableHead>
                      <TableHead className="hidden sm:table-cell">Schema</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.rowsBySource?.map((row) => (
                      <TableRow key={row.tableName}>
                        <TableCell className="text-xs sm:text-sm">{row.tableName}</TableCell>
                        <TableCell className="hidden sm:table-cell">{row.source}</TableCell>
                        <TableCell className="text-right font-mono">{formatCount(row.rows)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : null}
            </Table>
          ) : null}
      </DashboardTableCard>
    </AppShell>
  );
}
