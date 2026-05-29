import type { StoredEntry } from "@/lib/types";

const BRACKETS_LOCK_AT_ISO = "2026-06-11T19:00:00Z";

function isFilledScore(value: number | "" | undefined) {
  return typeof value === "number";
}

function totalKnockoutMatches(entry: StoredEntry) {
  if (!entry.knockout_preview?.predicted_bracket) {
    return 0;
  }

  return Object.values(entry.knockout_preview.predicted_bracket).reduce(
    (sum, matches) => sum + (matches?.length ?? 0),
    0
  );
}

export function getEntryChampionTeam(entry: StoredEntry) {
  return (
    entry.knockout_picks?.find((pick) => pick.slot_id === "M104")?.winner_team ?? null
  );
}

export function isEntryComplete(entry: StoredEntry) {
  if (entry.status === "scored") {
    return true;
  }

  const hasAllGroupScores =
    entry.predictions.length > 0 &&
    entry.predictions.every(
      (prediction) =>
        isFilledScore(prediction.home_score) && isFilledScore(prediction.away_score)
    );

  const knockoutMatchCount = totalKnockoutMatches(entry);
  const hasAllKnockoutPicks =
    knockoutMatchCount > 0 && (entry.knockout_picks?.length ?? 0) === knockoutMatchCount;

  return hasAllGroupScores && hasAllKnockoutPicks && Boolean(getEntryChampionTeam(entry));
}

export function bracketsLocked() {
  return Date.now() >= Date.parse(BRACKETS_LOCK_AT_ISO);
}
