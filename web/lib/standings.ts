import type { Match, MatchPrediction, TournamentConfig } from "@/lib/types";

export type TeamStats = {
  team: string;
  groupId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export function initializeGroupStats(
  tournament: TournamentConfig,
  groupId: string
): Record<string, TeamStats> {
  const group = tournament.groups.find((g) => g.id === groupId);
  if (!group) {
    throw new Error(`Unknown group: ${groupId}`);
  }

  const stats: Record<string, TeamStats> = {};
  for (const team of group.teams) {
    stats[team] = {
      team,
      groupId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  }

  return stats;
}

export function applyMatchResult(
  stats: Record<string, TeamStats>,
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number
) {
  const home = stats[homeTeam];
  const away = stats[awayTeam];

  home.played += 1;
  away.played += 1;

  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;

  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (homeScore > awayScore) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
  } else if (awayScore > homeScore) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }
}

export function getMatchesForGroup(
  tournament: TournamentConfig,
  groupId: string
): Match[] {
  return tournament.matches.filter((match) => match.group_id === groupId);
}

export function computeGroupStandings(
  tournament: TournamentConfig,
  groupId: string,
  predictions: Record<string, MatchPrediction>
): TeamStats[] {
  const stats = initializeGroupStats(tournament, groupId);
  const matches = getMatchesForGroup(tournament, groupId);

  for (const match of matches) {
    const prediction = predictions[match.id];
    if (!prediction) continue;

    if (
      typeof prediction.home_score === "number" &&
      typeof prediction.away_score === "number"
    ) {
      applyMatchResult(
        stats,
        match.home_team,
        match.away_team,
        prediction.home_score,
        prediction.away_score
      );
    }
  }

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team);
  });
}