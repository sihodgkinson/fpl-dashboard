export type LeagueIQView = "tables";

export interface LeagueIQViewConfig {
  key: LeagueIQView;
  label: string;
  shortLabel: string;
  path: string;
}

export const LEAGUEIQ_BASE_PATH = "/dashboard/leagueiq";

export const LEAGUEIQ_VIEWS: LeagueIQViewConfig[] = [
  {
    key: "tables",
    label: "Tables",
    shortLabel: "Tables",
    path: `${LEAGUEIQ_BASE_PATH}/tables`,
  },
];

export const LEAGUEIQ_VIEW_BY_KEY: Record<LeagueIQView, LeagueIQViewConfig> = {
  tables: LEAGUEIQ_VIEWS[0],
};

export function isLeagueIQView(value: string): value is LeagueIQView {
  return value === "tables";
}
