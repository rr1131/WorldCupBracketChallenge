"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TeamBadge from "@/components/entry/TeamBadge";
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

type ViewerTab = "overview" | "groups" | "knockout";
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
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rr-frame rounded-[32px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                {canEdit ? "Open Entry" : "View Entry"}
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-[#251a18]">{entry.entry_name}</h1>
              <p className="rr-body mt-3 text-base">
                Built by {entry.owner_name}. Toggle through groups and knockout picks while live
                scoring rolls in from official results.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canEdit ? (
                <Link
                  href={`/entries/${entry.id}`}
                  className="rr-primary-btn rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Edit Entry
                </Link>
              ) : null}
              <Link
                href="/workspace"
                className="rr-secondary-btn rounded-full px-5 py-3 text-sm font-semibold"
              >
                Back to My Wizard
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rr-card-soft rounded-2xl p-4">
              <div className="rr-soft text-xs uppercase tracking-[0.18em]">Status</div>
              <div className="mt-2 text-2xl font-semibold text-[#251a18]">{entry.status}</div>
            </div>
            <div className="rr-card-soft rounded-2xl p-4">
              <div className="rr-soft text-xs uppercase tracking-[0.18em]">Pts / Max</div>
              <div className="mt-2 text-2xl font-semibold text-[#8e1f29]">
                {entry.result?.total_points ?? entry.score_total ?? "—"}
              </div>
              <div className="mt-1 text-sm text-[#8e1f29]/70">
                {entry.max_possible_points ?? "—"}
              </div>
            </div>
            <div className="rr-card-soft rounded-2xl p-4">
              <div className="rr-soft text-xs uppercase tracking-[0.18em]">Pools</div>
              <div className="mt-2 text-2xl font-semibold text-[#251a18]">{entry.pool_ids.length}</div>
            </div>
            <div className="rr-card-soft rounded-2xl p-4">
              <div className="rr-soft text-xs uppercase tracking-[0.18em]">Updated</div>
              <div className="mt-2 text-base font-semibold text-[#251a18]">
                {new Date(entry.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="rr-tab-strip mt-8 inline-flex rounded-full p-1">
            {(["overview", "groups", "knockout"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={[
                  "rounded-full px-5 py-2 text-sm font-semibold capitalize transition",
                  tab === value
                    ? "rr-tab-active"
                    : "rr-tab-idle",
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
                  className="rr-card rounded-[28px] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="rr-soft text-xs font-semibold uppercase tracking-[0.18em]">
                        Group {group.id}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[#251a18]">
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
            <div className="rr-card rounded-[28px] p-5">
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
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
                        ? "border-[rgba(196,52,64,0.24)] bg-[#fdeef0] text-[#611019]"
                        : "border-[rgba(146,86,76,0.14)] bg-[#fff8f7] text-[#6b5752] hover:bg-[#fff2f1]",
                    ].join(" ")}
                  >
                    Group {group.id}
                  </button>
                ))}
              </div>
            </div>

            <div className="rr-card rounded-[28px] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                    Group {selectedGroupId}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
                    Group-stage picks
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rr-card-soft rounded-2xl p-4">
                  <div className="text-sm font-semibold text-[#251a18]">Predicted standings</div>
                  <div className="mt-4 space-y-2">
                    {selectedStandings.map((team, index) => (
                      <div
                        key={team.team}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(146,86,76,0.14)] bg-white px-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rr-soft w-6 text-xs font-semibold uppercase">
                            {index + 1}
                          </div>
                          <TeamBadge teamCode={team.team} tone="dark" compact />
                        </div>
                        <div className="rr-body text-right text-xs">
                          <div>{team.points} pts</div>
                          <div>GD {team.goalDifference}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rr-card-soft rounded-2xl p-4">
                  <div className="text-sm font-semibold text-[#251a18]">Match picks</div>
                  <div className="mt-4 grid gap-3">
                    {selectedGroupMatches.map((match: Match) => {
                      const prediction = predictionsById[match.id];
                      return (
                        <div
                          key={match.id}
                          className="rounded-2xl border border-[rgba(146,86,76,0.14)] bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <TeamBadge teamCode={match.home_team} tone="dark" compact />
                            <div className="rr-score-card rounded-xl px-4 py-2 text-sm font-semibold">
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
          <section className="rr-card rounded-[28px] p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                  Knockout Stage
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
                  Knockout picks by round
                </h2>
              </div>

              <div className="rr-tab-strip inline-flex rounded-full p-1">
                {availableRounds.map((roundName) => (
                  <button
                    key={roundName}
                    type="button"
                    onClick={() => setSelectedRound(roundName)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      activeRound === roundName
                        ? "rr-tab-active"
                        : "rr-tab-idle",
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
                    className="rr-card-soft rounded-[24px] p-5"
                  >
                    <div className="rr-soft text-xs font-semibold uppercase tracking-[0.18em]">
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
                                ? "border-[rgba(196,52,64,0.24)] bg-[#fdeef0]"
                                : "border-[rgba(146,86,76,0.14)] bg-white",
                            ].join(" ")}
                          >
                            <TeamBadge teamCode={team} tone={selectedWinner === team ? "gold" : "dark"} compact />
                          </div>
                        ) : (
                          <div
                            key={`${match.slot_id}-tbd`}
                            className="rr-inline-note rounded-2xl px-4 py-4 text-sm"
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
                <div className="rr-inline-note rounded-2xl px-4 py-6 text-sm">
                  This entry has not generated knockout picks yet.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

      </div>
    </main>
  );
}
