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

export type EntryPayload = {
  entry_name: string;
  predictions: MatchPrediction[];
};