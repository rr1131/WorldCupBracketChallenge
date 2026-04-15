import { useMemo } from "react";
import tournament from "@/data/tournament.json";
import type { TournamentConfig } from "@/lib/types";

export type SimulatedScoreResponse = {
  entry_name: string;
  match_points: number;
  standing_points: number;
  total_points: number;
  exact_order_count: number;
  top_two_bonus_count: number;
  group_scores: Array<{
    group_id: string;
    exact_position_points: number;
    top_two_bonus: number;
    exact_order_bonus: number;
    total_points: number;
  }>;
  match_scores: Array<{
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
  }>;
};

const typedTournament = tournament as TournamentConfig;

type SimulationResultsProps = {
  result: SimulatedScoreResponse;
};

export default function SimulationResults({
  result,
}: SimulationResultsProps) {
  const matchScoresByGroup = useMemo(() => {
    const grouped: Record<string, SimulatedScoreResponse["match_scores"]> = {};
    for (const matchScore of result.match_scores) {
      if (!grouped[matchScore.group_id]) {
        grouped[matchScore.group_id] = [];
      }
      grouped[matchScore.group_id].push(matchScore);
    }
    return grouped;
  }, [result]);

  const groupScoresById = useMemo(() => {
    const grouped: Record<string, SimulatedScoreResponse["group_scores"][number]> = {};
    for (const groupScore of result.group_scores) {
      grouped[groupScore.group_id] = groupScore;
    }
    return grouped;
  }, [result]);

  return (
    <section className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
      <h2 className="text-2xl font-bold">Simulation Result</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Match points</div>
          <div className="mt-1 text-2xl font-bold">{result.match_points}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Standings points</div>
          <div className="mt-1 text-2xl font-bold">{result.standing_points}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Total points</div>
          <div className="mt-1 text-2xl font-bold">{result.total_points}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Exact group orders</div>
          <div className="mt-1 text-xl font-semibold">{result.exact_order_count}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Top-two bonuses hit</div>
          <div className="mt-1 text-xl font-semibold">{result.top_two_bonus_count}</div>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <h3 className="text-xl font-semibold">Group breakdown</h3>

        {typedTournament.groups.map((group) => {
          const groupScore = groupScoresById[group.id];
          const groupMatchScores = matchScoresByGroup[group.id] ?? [];

          const groupMatchPoints = groupMatchScores.reduce(
            (sum, match) => sum + match.points,
            0
          );
          const groupStandingPoints = groupScore?.total_points ?? 0;
          const groupTotalPoints = groupMatchPoints + groupStandingPoints;

          return (
            <div
              key={group.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Group {group.id}</h4>
                  <p className="text-sm text-slate-400">{group.teams.join(" • ")}</p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
                  <div className="text-sm text-slate-400">Total group points</div>
                  <div className="text-xl font-bold">{groupTotalPoints}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Match points</div>
                  <div className="mt-1 text-lg font-semibold">{groupMatchPoints}</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Standings points</div>
                  <div className="mt-1 text-lg font-semibold">{groupStandingPoints}</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Top-two bonus</div>
                  <div className="mt-1 text-lg font-semibold">
                    {groupScore?.top_two_bonus ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Exact-order bonus</div>
                  <div className="mt-1 text-lg font-semibold">
                    {groupScore?.exact_order_bonus ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-300">
                  Standings scoring
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <div className="text-sm text-slate-400">Exact placement points</div>
                    <div className="mt-1 text-lg font-semibold">
                      {groupScore?.exact_position_points ?? 0}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <div className="text-sm text-slate-400">Top-two bonus</div>
                    <div className="mt-1 text-lg font-semibold">
                      {groupScore?.top_two_bonus ?? 0}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <div className="text-sm text-slate-400">Exact-order bonus</div>
                    <div className="mt-1 text-lg font-semibold">
                      {groupScore?.exact_order_bonus ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-300">
                  Match scoring
                </div>

                <div className="space-y-3">
                  {groupMatchScores.map((matchScore) => (
                    <div
                      key={matchScore.match_id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            {matchScore.match_id}
                          </div>
                          <div className="mt-1 font-medium">
                            {matchScore.home_team} vs {matchScore.away_team}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold">
                          {matchScore.points} pts
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs text-slate-500">Predicted</div>
                          <div className="mt-1 text-sm">
                            {matchScore.home_team} {matchScore.predicted_home_score} -{" "}
                            {matchScore.predicted_away_score} {matchScore.away_team}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500">Actual</div>
                          <div className="mt-1 text-sm">
                            {matchScore.home_team} {matchScore.actual_home_score} -{" "}
                            {matchScore.actual_away_score} {matchScore.away_team}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500">Result</div>
                          <div className="mt-1 text-sm">{matchScore.reason}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {groupMatchScores.length === 0 && (
                    <div className="text-sm text-slate-500">
                      No match scoring data returned for this group.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}