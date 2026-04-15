"use client";

import { useMemo, useState } from "react";
import GroupCard from "@/components/entry/GroupCard";
import SimulationResults, {
  type SimulatedScoreResponse,
} from "@/components/entry/SimulationResults";
import tournament from "@/data/tournament.json";
import type { EntryPayload, MatchPrediction, TournamentConfig } from "@/lib/types";

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

  const [simulationResult, setSimulationResult] = useState<SimulatedScoreResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

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
  }

  const completedCount = useMemo(() => {
    return Object.values(predictions).filter(
      (p) => p.home_score !== "" && p.away_score !== ""
    ).length;
  }, [predictions]);

  const allMatchesCompleted = completedCount === typedTournament.matches.length;
  const hasEntryName = entryName.trim().length > 0;

  const entryPreview: EntryPayload = useMemo(() => {
    return {
      entry_name: entryName || "unnamed-entry",
      predictions: typedTournament.matches.map((match) => predictions[match.id]),
    };
  }, [entryName, predictions]);

  async function simulateEntry() {
    setSimulationError(null);
    setSimulationResult(null);

    if (!hasEntryName) {
      setSimulationError("Please enter an entry name before simulating.");
      return;
    }

    if (!allMatchesCompleted) {
      setSimulationError("Please fill in every group-stage match before simulating.");
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while simulating entry.";
      setSimulationError(message);
    } finally {
      setIsSimulating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">Create World Cup Entry</h1>
          <p className="mt-2 text-slate-400">
            Enter your predicted score for every group-stage match.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Entry name
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none"
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
                placeholder="alice"
              />
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
              <div className="text-sm text-slate-400">Completion</div>
              <div className="mt-1 text-lg font-semibold">
                {completedCount} / {typedTournament.matches.length} matches filled
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={simulateEntry}
              disabled={isSimulating}
              className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSimulating ? "Simulating..." : "Simulate Entry"}
            </button>
          </div>

          {simulationError && (
            <div className="mt-4 rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {simulationError}
            </div>
          )}
        </section>

        {simulationResult && <SimulationResults result={simulationResult} />}

        <section className="grid gap-6 lg:grid-cols-2">
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Entry payload preview</h2>
          <p className="mt-2 text-sm text-slate-400">
            This is the shape your backend accepts for simulation.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
            {JSON.stringify(entryPreview, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}