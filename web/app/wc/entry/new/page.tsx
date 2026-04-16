"use client";

import { useMemo, useState } from "react";
import GroupCard from "@/components/entry/GroupCard";
import KnockoutBracketPicker from "@/components/entry/KnockoutBracketPicker";
import SimulationResults from "@/components/entry/SimulationResults";
import tournament from "@/data/tournament.json";
import {
  buildKnockoutPicks,
  sanitizeKnockoutPickLookup,
  type KnockoutPickLookup,
} from "@/lib/knockout";
import type {
  EntryPayload,
  MatchPrediction,
  SimulatedScoreResponse,
  TournamentConfig,
} from "@/lib/types";

const typedTournament = tournament as TournamentConfig;

function getMatchesForGroup(groupId: string) {
  return typedTournament.matches.filter((match) => match.group_id === groupId);
}

export default function NewEntryPage() {
  const [entryName, setEntryName] = useState("");
  const [predictions, setPredictions] = useState<Record<string, MatchPrediction>>(() => {
    const initial: Record<string, MatchPrediction> = {};
    for (const match of typedTournament.matches) {
      initial[match.id] = {
        match_id: match.id,
        home_score: "",
        away_score: "",
      };
    }
    return initial;
  });
  const [knockoutPicksBySlot, setKnockoutPicksBySlot] = useState<KnockoutPickLookup>({});
  const [simulationResult, setSimulationResult] = useState<SimulatedScoreResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  function clearSimulationState() {
    setSimulationResult(null);
    setSimulationError(null);
    setKnockoutPicksBySlot({});
  }

  function updateEntryName(value: string) {
    setEntryName(value);
    clearSimulationState();
  }

  function updatePrediction(
    matchId: string,
    side: "home_score" | "away_score",
    value: string
  ) {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: value === "" ? "" : Number(value),
      },
    }));

    clearSimulationState();
  }

  function updateKnockoutPick(slotId: string, winnerTeam: string) {
    if (!simulationResult) {
      return;
    }

    setKnockoutPicksBySlot((prev) => {
      const next = { ...prev };

      if (next[slotId] === winnerTeam) {
        delete next[slotId];
      } else {
        next[slotId] = winnerTeam;
      }

      return sanitizeKnockoutPickLookup(simulationResult.predicted_bracket, next);
    });
  }

  const completedCount = useMemo(() => {
    return Object.values(predictions).filter(
      (prediction) => prediction.home_score !== "" && prediction.away_score !== ""
    ).length;
  }, [predictions]);

  const allMatchesCompleted = completedCount === typedTournament.matches.length;
  const hasEntryName = entryName.trim().length > 0;
  const knockoutPicks = useMemo(() => {
    if (!simulationResult) {
      return [];
    }

    return buildKnockoutPicks(simulationResult.predicted_bracket, knockoutPicksBySlot);
  }, [knockoutPicksBySlot, simulationResult]);

  const hasKnockoutBracket = useMemo(() => {
    return (simulationResult?.predicted_bracket.R32?.length ?? 0) > 0;
  }, [simulationResult]);

  const entryPreview: EntryPayload = useMemo(() => {
    return {
      entry_name: entryName || "unnamed-entry",
      predictions: typedTournament.matches.map((match) => predictions[match.id]),
      knockout_picks: knockoutPicks.length > 0 ? knockoutPicks : undefined,
    };
  }, [entryName, knockoutPicks, predictions]);

  async function simulateEntry() {
    setSimulationError(null);

    if (!hasEntryName) {
      setSimulationError("Please enter an entry name before scoring the entry.");
      return;
    }

    if (!allMatchesCompleted) {
      setSimulationError("Please fill in every group-stage match before generating the bracket.");
      return;
    }

    try {
      setIsSimulating(true);

      const response = await fetch("http://127.0.0.1:8000/api/score-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryPreview),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to score entry.");
      }

      const data: SimulatedScoreResponse = await response.json();
      setSimulationResult(data);
      setKnockoutPicksBySlot((prev) =>
        sanitizeKnockoutPickLookup(data.predicted_bracket, prev)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while simulating entry.";
      setSimulationError(message);
    } finally {
      setIsSimulating(false);
    }
  }

  const actionLabel = isSimulating
    ? "Scoring..."
    : simulationResult
      ? knockoutPicks.length > 0
        ? "Update Score with Knockout Picks"
        : "Refresh Score"
      : "Generate Knockout Bracket";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7_0%,#fff8eb_22%,#f8fafc_58%,#e2e8f0_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_32px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-amber-700">
                World Cup Bracket Challenge
              </div>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
                Score the groups, generate your bracket, then lock in knockout winners.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Run the scorer once to generate the knockout stage from your group picks.
                After that, pick winners round by round and resubmit to include knockout
                scoring.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Entry name
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                    value={entryName}
                    onChange={(event) => updateEntryName(event.target.value)}
                    placeholder="alice"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm text-slate-500">Group completion</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {completedCount} / {typedTournament.matches.length}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={simulateEntry}
                  disabled={isSimulating}
                  className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLabel}
                </button>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {hasKnockoutBracket
                    ? `${knockoutPicks.length} knockout winners selected`
                    : "No knockout picks yet"}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(160deg,#fffdf7_0%,#fff7ed_55%,#ffedd5_100%)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                How it works
              </div>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  1. Complete all group-stage scorelines. The standings preview updates live
                  as you type.
                </p>
                <p>
                  2. Generate the bracket preview. The backend returns the knockout slots
                  implied by your group table.
                </p>
                <p>
                  3. Pick winners in each knockout round, then update the score to include
                  knockout points in the result.
                </p>
              </div>
            </div>
          </div>

          {simulationError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {simulationError}
            </div>
          )}
        </section>

        {simulationResult && <SimulationResults result={simulationResult} />}

        {simulationResult && hasKnockoutBracket && (
          <KnockoutBracketPicker
            baseBracket={simulationResult.predicted_bracket}
            picksBySlot={knockoutPicksBySlot}
            onSelectWinner={updateKnockoutPick}
          />
        )}

        {simulationResult && !hasKnockoutBracket && (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            The scorer returned group-stage results, but no knockout bracket yet. Once the
            backend provides Round of 32 slots, this page will unlock the winner picker
            automatically.
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {typedTournament.groups.map((group) => (
            <GroupCard
              key={group.id}
              tournament={typedTournament}
              group={group}
              matches={getMatchesForGroup(group.id)}
              predictions={predictions}
              onChange={updatePrediction}
            />
          ))}
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-950">Entry payload preview</h2>
          <p className="mt-2 text-sm text-slate-500">
            This is the request body currently being sent to `/api/score-entry`.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-200">
            {JSON.stringify(entryPreview, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
