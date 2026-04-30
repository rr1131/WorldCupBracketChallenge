export type Group = {
  id: string;
  teams: string[];
};

export type Match = {
  id: string;
  group_id: string;
  home_team: string;
  away_team: string;
};

export type TournamentConfig = {
  groups: Group[];
  matches: Match[];
};

export type MatchPrediction = {
  match_id: string;
  home_score: number | "";
  away_score: number | "";
};

export type KnockoutRoundName = "R32" | "R16" | "QF" | "SF" | "FINAL";

export type KnockoutPick = {
  round_name: KnockoutRoundName;
  slot_id: string;
  winner_team: string;
};

export type GroupStandingRow = {
  position: number;
  team: string;
  group_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

export type GroupScoreBreakdown = {
  group_id: string;
  exact_position_points: number;
  top_two_bonus: number;
  exact_order_bonus: number;
  total_points: number;
};

export type MatchScoreBreakdown = {
  match_id: string;
  group_id: string;
  home_team: string;
  away_team: string;
  predicted_home_score: number;
  predicted_away_score: number;
  actual_home_score: number;
  actual_away_score: number;
  points: number;
  reason: string;
};

export type KnockoutMatch = {
  round_name: KnockoutRoundName;
  slot_id: string;
  home_team: string | null;
  away_team: string | null;
};

export type KnockoutBracket = Partial<Record<KnockoutRoundName, KnockoutMatch[]>>;

export type KnockoutScoreBreakdown = {
  stage_name: KnockoutRoundName | "CHAMPION";
  team: string;
  points: number;
  reason: string;
};

export type EntryPayload = {
  entry_name: string;
  predictions: MatchPrediction[];
  advancing_third_place_groups?: string[];
  knockout_picks?: KnockoutPick[];
};

export type KnockoutBracketPreviewResponse = {
  entry_name: string;
  predicted_standings: Record<string, GroupStandingRow[]>;
  predicted_bracket: KnockoutBracket;
  advancing_third_place_groups?: string[] | null;
};

export type SimulatedScoreResponse = {
  entry_name: string;
  match_points: number;
  standing_points: number;
  knockout_points: number;
  total_points: number;
  exact_order_count: number;
  top_two_bonus_count: number;
  group_scores: GroupScoreBreakdown[];
  match_scores: MatchScoreBreakdown[];
  knockout_scores: KnockoutScoreBreakdown[];
  predicted_standings: Record<string, GroupStandingRow[]>;
  actual_standings: Record<string, GroupStandingRow[]>;
  predicted_bracket: KnockoutBracket;
  actual_bracket: KnockoutBracket;
  knockout_warning?: string | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type RegisteredUser = AuthUser & {
  password: string;
};

export type EntryStatus = "draft" | "knockout" | "scored";

export type StoredEntry = {
  id: string;
  owner_id: string;
  owner_name: string;
  entry_name: string;
  created_at: string;
  updated_at: string;
  status: EntryStatus;
  predictions: MatchPrediction[];
  advancing_third_place_groups?: string[];
  knockout_picks?: KnockoutPick[];
  knockout_preview?: KnockoutBracketPreviewResponse | null;
  result?: SimulatedScoreResponse | null;
  pool_ids: string[];
  score_total?: number | null;
};

export type PoolRecord = {
  id: string;
  name: string;
  description: string;
  accent: string;
  invite_code: string;
  owner_id: string;
  owner_name: string;
  member_ids: string[];
  created_at: string;
};

export type PersistedAppState = {
  current_user_id: string | null;
  users: RegisteredUser[];
  entries: StoredEntry[];
  pools: PoolRecord[];
};
