import { useMemo } from "react";
import tournament from "@/data/tournament.json";
import { KNOCKOUT_ROUNDS } from "@/lib/knockout";
import type { SimulatedScoreResponse, TournamentConfig } from "@/lib/types";

const typedTournament = tournament as TournamentConfig;
const KNOCKOUT_SCORING_STAGES = [...KNOCKOUT_ROUNDS, "CHAMPION"] as const;

type SimulationResultsProps = {
  result: SimulatedScoreResponse;
};

export default function SimulationResults({
  result,
}: SimulationResultsProps) {
  const knockoutScoresByStage = useMemo(() => {
    const grouped: Record<string, SimulatedScoreResponse["knockout_scores"]> = {};

    for (const stageName of KNOCKOUT_SCORING_STAGES) {
      grouped[stageName] = [];
    }

    for (const knockoutScore of result.knockout_scores) {
      grouped[knockoutScore.stage_name] ??= [];
      grouped[knockoutScore.stage_name].push(knockoutScore);
    }

    return grouped;
  }, [result]);

  const matchScoresByGroup = useMemo(() => {
    const grouped: Record<string, SimulatedScoreResponse["match_scores"]> = {};
    for (const matchScore of result.match_scores) {
      grouped[matchScore.group_id] ??= [];
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
    <section className="rounded-[28px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] p-6 shadow-[0_30px_90px_rgba(16,185,129,0.12)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
            Scorecard
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Simulation result for {result.entry_name}
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Match points</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{result.match_points}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Standings points</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">
            {result.standing_points}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Knockout points</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">
            {result.knockout_points}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-900 bg-slate-950 p-4 text-white">
          <div className="text-sm text-slate-400">Total points</div>
          <div className="mt-1 text-2xl font-bold">{result.total_points}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Exact group orders</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">
            {result.exact_order_count}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Top-two bonuses hit</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">
            {result.top_two_bonus_count}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Knockout breakdown</h3>
            <p className="mt-1 text-sm text-slate-500">
              Points are awarded for each team you correctly place into each stage, even if
              their exact path through the bracket differs.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {result.knockout_scores.length} scored picks
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {KNOCKOUT_SCORING_STAGES.map((stageName) => {
            const stageScores = knockoutScoresByStage[stageName] ?? [];
            const stagePoints = stageScores.reduce((sum, item) => sum + item.points, 0);

            return (
              <div
                key={stageName}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {stageName}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">
                      {stagePoints} pts
                    </div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    {stageScores.length} teams
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {stageScores.map((score) => (
                    <article
                      key={`${score.stage_name}-${score.team}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {score.stage_name}
                        </div>
                        <div className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white">
                          {score.points} pts
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <div>
                          <span className="text-slate-500">Team:</span>{" "}
                          <span className="font-medium text-slate-900">{score.team}</span>
                        </div>
                        <div className="text-slate-500">{score.reason}</div>
                      </div>
                    </article>
                  ))}

                  {stageScores.length === 0 && (
                    <div className="text-sm text-slate-500">
                      No teams scored for this stage.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <h3 className="text-xl font-semibold text-slate-950">Group breakdown</h3>

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
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-950">Group {group.id}</h4>
                  <p className="text-sm text-slate-500">{group.teams.join(" • ")}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm text-slate-500">Total group points</div>
                  <div className="text-xl font-bold text-slate-950">{groupTotalPoints}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Match points</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {groupMatchPoints}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Standings points</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {groupStandingPoints}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Top-two bonus</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {groupScore?.top_two_bonus ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Exact-order bonus</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {groupScore?.exact_order_bonus ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">
                  Standings scoring
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-sm text-slate-500">Exact placement points</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">
                      {groupScore?.exact_position_points ?? 0}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-sm text-slate-500">Top-two bonus</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">
                      {groupScore?.top_two_bonus ?? 0}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-sm text-slate-500">Exact-order bonus</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">
                      {groupScore?.exact_order_bonus ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">
                  Match scoring
                </div>

                <div className="space-y-3">
                  {groupMatchScores.map((matchScore) => (
                    <article
                      key={matchScore.match_id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            {matchScore.match_id}
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {matchScore.home_team} vs {matchScore.away_team}
                          </div>
                        </div>

                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
                          {matchScore.points} pts
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs text-slate-400">Predicted</div>
                          <div className="mt-1 text-sm text-slate-700">
                            {matchScore.home_team} {matchScore.predicted_home_score} -{" "}
                            {matchScore.predicted_away_score} {matchScore.away_team}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-400">Actual</div>
                          <div className="mt-1 text-sm text-slate-700">
                            {matchScore.home_team} {matchScore.actual_home_score} -{" "}
                            {matchScore.actual_away_score} {matchScore.away_team}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-400">Result</div>
                          <div className="mt-1 text-sm text-slate-700">
                            {matchScore.reason}
                          </div>
                        </div>
                      </div>
                    </article>
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
