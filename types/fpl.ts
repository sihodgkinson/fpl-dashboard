// types/fpl.ts

/**
 * Represents a single team/manager entry in the league standings.
 */
export interface LeagueStandingsEntry {
  id: number;
  entry: number; // team ID
  entry_name: string; // team name
  player_name: string; // manager name
  rank: number; // current rank
  last_rank: number; // previous rank
  event_total: number; // points scored in the current GW
  total: number; // total points overall
}

/**
 * Represents the league metadata (name, id, etc.)
 */
export interface LeagueMeta {
  id: number;
  name: string;
  created: string;
  closed: boolean;
  max_entries: number | null;
  league_type: string;
  scoring: string;
  admin_entry: number;
  start_event: number;
  code_privacy: string;
  has_cup: boolean;
  cup_league: null | number;
  rank: null | number;
}

/**
 * Full response from the FPL Classic League standings endpoint.
 */
export interface ClassicLeagueResponse {
  league: LeagueMeta;
  new_entries: {
    has_next: boolean;
    page: number;
    results: unknown[];
  };
  standings: {
    has_next: boolean;
    page: number;
    results: LeagueStandingsEntry[];
  };
}

export interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  average_entry_score: number;
  finished: boolean;
  data_checked: boolean;
  highest_scoring_entry: number | null;
  deadline_time_epoch: number;
  deadline_time_game_offset: number;
  highest_score: number | null;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
}

export interface EnrichedStanding {
  entry: number;
  entry_name: string;
  player_name: string;
  gwPoints: number;
  totalPoints: number;
  transfers: number;
  hit: number;
  benchPoints: number;
  rank: number;
  movement: number; // optional, since we may add movement later
}