"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TeamBadge from "@/components/entry/TeamBadge";
import SimulationResults from "@/components/entry/SimulationResults";
import tournament from "@/data/tournament.json";
import { deriveKnockoutBracket } from "@/lib/knockout";
import { computeGroupStandings } from "@/lib/standings";
import type {
  KnockoutPick,
  Match,
  MatchPrediction,
  StoredEntry,
  TournamentConfig,
} from "@/lib/types";

const typedTournament = tournament as TournamentConfig;

type EntryViewerProps = {
  entry: StoredEntry;
  canEdit?: boolean;
};

type ViewerTab = "overview" | "groups" | "knockout" | "score";
type KnockoutViewerRound = "R32" | "R16" | "QF" | "SF" | "FINAL";

function toPredictionLookup(predictions: MatchPrediction[]) {
  return Object.fromEntries(predictions.map((prediction) => [prediction.match_id, prediction])) as Record<
    string,
    MatchPrediction
  >;
}

function toKnockoutPickLookup(knockoutPicks: KnockoutPick[] | undefined) {
  return Object.fromEntries(
    (knockoutPicks ?? []).map((pick) => [pick.slot_id, pick.winner_team])
  );
}

function groupMatches(groupId: string) {
  return typedTournament.matches.filter((match) => match.group_id === groupId);
}

export default function EntryViewer({ entry, canEdit = false }: EntryViewerProps) {
  const [tab, setTab] = useState<ViewerTab>("overview");
  const [selectedGroupId, setSelectedGroupId] = useState(typedTournament.groups[0]?.id ?? "A");
  const [selectedRound, setSelectedRound] = useState<KnockoutViewerRound>("R32");

  const predictionsById = useMemo(() => toPredictionLookup(entry.predictions), [entry.predictions]);
  const selectedGroupMatches = useMemo(() => groupMatches(selectedGroupId), [selectedGroupId]);
  const selectedStandings = useMemo(
    () => computeGroupStandings(typedTournament, selectedGroupId, predictionsById),
    [predictionsById, selectedGroupId]
  );

  const knockoutBracket = useMemo(
    () =>
      deriveKnockoutBracket(
        entry.knockout_preview?.predicted_bracket ?? entry.result?.predicted_bracket ?? {},
        toKnockoutPickLookup(entry.knockout_picks)
      ),
    [entry.knockout_picks, entry.knockout_preview?.predicted_bracket, entry.result?.predicted_bracket]
  );

  const availableRounds = useMemo(
    () =>
      (["R32", "R16", "QF", "SF", "FINAL"] as const).filter(
        (roundName) => (knockoutBracket[roundName] ?? []).length > 0
      ),
    [knockoutBracket]
  );
  const activeRound = availableRounds.includes(selectedRound)
    ? selectedRound
    : (availableRounds[0] ?? "R32");
  const roundMatches = knockoutBracket[activeRound] ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#13385d_0%,#0b2442_34%,#06111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/75">
                {canEdit ? "Open Entry" : "View Entry"}
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-white">{entry.entry_name}</h1>
              <p className="mt-3 text-base text-cyan-100/72">
                Built by {entry.owner_name}. Toggle through groups, knockout picks, and the
                score summary.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canEdit ? (
                <Link
                  href={`/entries/${entry.id}`}
                  className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                >
                  Edit Entry
                </Link>
              ) : null}
              <Link
                href="/workspace"
                className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                Back to Workspace
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Status</div>
              <div className="mt-2 text-2xl font-semibold text-white">{entry.status}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Score</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {entry.result?.total_points ?? entry.score_total ?? "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Pools</div>
              <div className="mt-2 text-2xl font-semibold text-white">{entry.pool_ids.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Updated</div>
              <div className="mt-2 text-base font-semibold text-white">
                {new Date(entry.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/6 p-1">
            {(["overview", "groups", "knockout", "score"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={[
                  "rounded-full px-5 py-2 text-sm font-semibold capitalize transition",
                  tab === value
                    ? "bg-[linear-gradient(135deg,#f7de88,#e4ad35)] text-slate-950"
                    : "text-white/74 hover:text-white",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        {tab === "overview" ? (
          <section className="grid gap-4 lg:grid-cols-3">
            {typedTournament.groups.map((group) => {
              const completedMatches = groupMatches(group.id).filter((match) => {
                const prediction = predictionsById[match.id];
                return prediction?.home_score !== "" && prediction?.away_score !== "";
              }).length;

              return (
                <div
                  key={group.id}
                  className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.4)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
                        Group {group.id}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {completedMatches} / 6 matches picked
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {group.teams.map((team) => (
                      <TeamBadge key={team} teamCode={team} tone="dark" compact />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {tab === "groups" ? (
          <section className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                Groups
              </div>
              <div className="mt-4 grid gap-2">
                {typedTournament.groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className={[
                      "rounded-2xl border px-4 py-3 text-left transition",
                      selectedGroupId === group.id
                        ? "border-amber-300/50 bg-amber-300/10 text-white"
                        : "border-white/10 bg-white/6 text-cyan-100/76 hover:bg-white/10",
                    ].join(" ")}
                  >
                    Group {group.id}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/75">
                    Group {selectedGroupId}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Group-stage picks
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="text-sm font-semibold text-white">Predicted standings</div>
                  <div className="mt-4 space-y-2">
                    {selectedStandings.map((team, index) => (
                      <div
                        key={team.team}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0c2438] px-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 text-xs font-semibold uppercase text-cyan-100/55">
                            {index + 1}
                          </div>
                          <TeamBadge teamCode={team.team} tone="dark" compact />
                        </div>
                        <div className="text-right text-xs text-cyan-100/66">
                          <div>{team.points} pts</div>
                          <div>GD {team.goalDifference}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="text-sm font-semibold text-white">Match picks</div>
                  <div className="mt-4 grid gap-3">
                    {selectedGroupMatches.map((match: Match) => {
                      const prediction = predictionsById[match.id];
                      return (
                        <div
                          key={match.id}
                          className="rounded-2xl border border-white/10 bg-[#0c2438] p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <TeamBadge teamCode={match.home_team} tone="dark" compact />
                            <div className="rounded-xl border border-amber-300/24 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-white">
                              {prediction?.home_score ?? "—"} : {prediction?.away_score ?? "—"}
                            </div>
                            <TeamBadge teamCode={match.away_team} tone="dark" compact align="right" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "knockout" ? (
          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/75">
                  Knockout Stage
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Knockout picks by round
                </h2>
              </div>

              <div className="inline-flex rounded-full border border-white/10 bg-white/6 p-1">
                {availableRounds.map((roundName) => (
                  <button
                    key={roundName}
                    type="button"
                    onClick={() => setSelectedRound(roundName)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      activeRound === roundName
                        ? "bg-[linear-gradient(135deg,#f7de88,#e4ad35)] text-slate-950"
                        : "text-white/74 hover:text-white",
                    ].join(" ")}
                  >
                    {roundName}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {roundMatches.map((match) => {
                const selectedWinner = (entry.knockout_picks ?? []).find(
                  (pick) => pick.slot_id === match.slot_id
                )?.winner_team;

                return (
                  <div
                    key={match.slot_id}
                    className="rounded-[24px] border border-white/10 bg-[#0c2438] p-5"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
                      {match.slot_id}
                    </div>
                    <div className="mt-4 space-y-3">
                      {[match.home_team, match.away_team].map((team) =>
                        team ? (
                          <div
                            key={`${match.slot_id}-${team}`}
                            className={[
                              "rounded-2xl border p-2",
                              selectedWinner === team
                                ? "border-amber-300/40 bg-amber-300/12"
                                : "border-white/10 bg-white/6",
                            ].join(" ")}
                          >
                            <TeamBadge teamCode={team} tone={selectedWinner === team ? "gold" : "dark"} compact />
                          </div>
                        ) : (
                          <div
                            key={`${match.slot_id}-tbd`}
                            className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm text-cyan-100/50"
                          >
                            Awaiting prior winner
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {roundMatches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-6 text-sm text-cyan-100/60">
                  This entry has not generated knockout picks yet.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "score" ? (
          entry.result ? (
            <SimulationResults result={entry.result} />
          ) : (
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 text-cyan-100/70 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
              This entry has not been fully scored yet.
            </section>
          )
        ) : null}
      </div>
    </main>
  );
}
