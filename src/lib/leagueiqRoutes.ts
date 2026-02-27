export type LeagueIQView = "league-table" | "manager-influence" | "gw1-table";

export interface LeagueIQViewConfig {
  key: LeagueIQView;
  label: string;
  shortLabel: string;
  path: string;
}

export const LEAGUEIQ_BASE_PATH = "/dashboard/leagueiq";

export const LEAGUEIQ_VIEWS: LeagueIQViewConfig[] = [
  {
    key: "league-table",
    label: "League Table",
    shortLabel: "League",
    path: `${LEAGUEIQ_BASE_PATH}/league-table`,
  },
  {
    key: "manager-influence",
    label: "Manager Influence",
    shortLabel: "Influence",
    path: `${LEAGUEIQ_BASE_PATH}/manager-influence`,
  },
  {
    key: "gw1-table",
    label: "GW1 Table",
    shortLabel: "GW1",
    path: `${LEAGUEIQ_BASE_PATH}/gw1-table`,
  },
];

export const LEAGUEIQ_VIEW_BY_KEY: Record<LeagueIQView, LeagueIQViewConfig> = {
  "league-table": LEAGUEIQ_VIEWS[0],
  "manager-influence": LEAGUEIQ_VIEWS[1],
  "gw1-table": LEAGUEIQ_VIEWS[2],
};

export function isLeagueIQView(value: string): value is LeagueIQView {
  return value === "league-table" || value === "manager-influence" || value === "gw1-table";
}
