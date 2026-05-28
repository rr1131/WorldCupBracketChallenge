import type { TournamentConfig } from "@/lib/types";

const MATCH_EXACT_SCORE_POINTS = 3;
const GROUP_EXACT_POSITION_POINTS = 2;
const GROUP_TOP_TWO_BONUS = 2;
const GROUP_EXACT_ORDER_BONUS = 3;

const KNOCKOUT_STAGE_POINTS = {
  R32: 2,
  R16: 4,
  QF: 8,
  SF: 16,
  FINAL: 32,
  CHAMPION: 64,
} as const;

function totalMatchPointsCeiling(tournament: TournamentConfig) {
  return tournament.matches.length * MATCH_EXACT_SCORE_POINTS;
}

function totalGroupPointsCeiling(tournament: TournamentConfig) {
  const groupMaxPoints =
    GROUP_EXACT_POSITION_POINTS * 4 + GROUP_TOP_TWO_BONUS + GROUP_EXACT_ORDER_BONUS;
  return tournament.groups.length * groupMaxPoints;
}

function totalKnockoutPointsCeiling() {
  return (
    32 * KNOCKOUT_STAGE_POINTS.R32 +
    16 * KNOCKOUT_STAGE_POINTS.R16 +
    8 * KNOCKOUT_STAGE_POINTS.QF +
    4 * KNOCKOUT_STAGE_POINTS.SF +
    2 * KNOCKOUT_STAGE_POINTS.FINAL +
    KNOCKOUT_STAGE_POINTS.CHAMPION
  );
}

export function maxTotalPoints(tournament: TournamentConfig) {
  return (
    totalMatchPointsCeiling(tournament) +
    totalGroupPointsCeiling(tournament) +
    totalKnockoutPointsCeiling()
  );
}
