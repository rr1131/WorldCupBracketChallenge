"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GroupCard from "@/components/entry/GroupCard";
import KnockoutBracketPicker from "@/components/entry/KnockoutBracketPicker";
import SimulationResults from "@/components/entry/SimulationResults";
import type { StoredEntry } from "@/lib/types";
import TeamBadge from "@/components/entry/TeamBadge";
import tournament from "@/data/tournament.json";
import {
  autofillKnockoutPickLookup,
  buildKnockoutPicks,
  sanitizeKnockoutPickLookup,
  type KnockoutPickLookup,
} from "@/lib/knockout";
import type {
  EntryPayload,
  KnockoutBracketPreviewResponse,
  MatchPrediction,
  SimulatedScoreResponse,
  TournamentConfig,
} from "@/lib/types";

const typedTournament = tournament as TournamentConfig;

type BuildPhase = "groups" | "knockout" | "results";

type ManualThirdPlaceTiebreakDetail = {
  code: "manual_third_place_tiebreak_required";
  message: string;
  locked_group_ids: string[];
  candidate_group_ids: string[];
  slots_remaining: number;
};

type EntryBuilderProps = {
  entry: StoredEntry;
  onSave: (updates: Partial<StoredEntry>) => void;
};

function getMatchesForGroup(groupId: string) {
  return typedTournament.matches.filter((match) => match.group_id === groupId);
}

function isManualThirdPlaceTiebreakDetail(
  detail: unknown
): detail is ManualThirdPlaceTiebreakDetail {
  if (!detail || typeof detail !== "object") {
    return false;
  }

  return (
    "code" in detail &&
    detail.code === "manual_third_place_tiebreak_required" &&
    "locked_group_ids" in detail &&
    "candidate_group_ids" in detail &&
    "slots_remaining" in detail
  );
}

function toPredictionLookup(predictions: MatchPrediction[]) {
  const existing = Object.fromEntries(predictions.map((prediction) => [prediction.match_id, prediction]));

  return Object.fromEntries(
    typedTournament.matches.map((match) => [
      match.id,
      existing[match.id] ?? {
        match_id: match.id,
        home_score: "",
        away_score: "",
      },
    ])
  ) as Record<string, MatchPrediction>;
}

function toKnockoutLookup(entry: StoredEntry) {
  return Object.fromEntries(
    (entry.knockout_picks ?? []).map((pick) => [pick.slot_id, pick.winner_team])
  ) as KnockoutPickLookup;
}

export default function EntryBuilder({ entry, onSave }: EntryBuilderProps) {
  const groupEditorRef = useRef<HTMLElement | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const [phase, setPhase] = useState<BuildPhase>(() => {
    if (entry.result) {
      return "results";
    }

    if (entry.knockout_preview) {
      return "knockout";
    }

    return "groups";
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [entryName, setEntryName] = useState(entry.entry_name);
  const [predictions, setPredictions] = useState<Record<string, MatchPrediction>>(() =>
    toPredictionLookup(entry.predictions)
  );
  const [knockoutPreview, setKnockoutPreview] =
    useState<KnockoutBracketPreviewResponse | null>(entry.knockout_preview ?? null);
  const [knockoutPicksBySlot, setKnockoutPicksBySlot] = useState<KnockoutPickLookup>(() =>
    toKnockoutLookup(entry)
  );
  const [result, setResult] = useState<SimulatedScoreResponse | null>(entry.result ?? null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [manualThirdPlaceTiebreak, setManualThirdPlaceTiebreak] =
    useState<ManualThirdPlaceTiebreakDetail | null>(null);
  const [selectedThirdPlaceGroups, setSelectedThirdPlaceGroups] = useState<string[]>(
    entry.advancing_third_place_groups ?? []
  );
  const [isWorking, setIsWorking] = useState(false);

  const groupProgress = useMemo(() => {
    return Object.fromEntries(
      typedTournament.groups.map((group) => {
        const matches = getMatchesForGroup(group.id);
        const completedMatches = matches.filter((match) => {
          const prediction = predictions[match.id];
          return prediction.home_score !== "" && prediction.away_score !== "";
        }).length;

        return [
          group.id,
          {
            totalMatches: matches.length,
            completedMatches,
            isComplete: completedMatches === matches.length,
          },
        ];
      })
    );
  }, [predictions]);

  const completedGroupsCount = useMemo(() => {
    return typedTournament.groups.filter((group) => groupProgress[group.id].isComplete).length;
  }, [groupProgress]);

  const completedMatchesCount = useMemo(() => {
    return Object.values(predictions).filter(
      (prediction) => prediction.home_score !== "" && prediction.away_score !== ""
    ).length;
  }, [predictions]);

  const allGroupsCompleted = completedGroupsCount === typedTournament.groups.length;

  const chosenAdvancingThirdPlaceGroups = useMemo(() => {
    if (!manualThirdPlaceTiebreak) {
      return selectedThirdPlaceGroups.length > 0 ? selectedThirdPlaceGroups : undefined;
    }

    if (selectedThirdPlaceGroups.length !== manualThirdPlaceTiebreak.slots_remaining) {
      return undefined;
    }

    return [
      ...manualThirdPlaceTiebreak.locked_group_ids,
      ...selectedThirdPlaceGroups,
    ].sort();
  }, [manualThirdPlaceTiebreak, selectedThirdPlaceGroups]);

  const resolvedAdvancingThirdPlaceGroups = useMemo(() => {
    return (
      chosenAdvancingThirdPlaceGroups ??
      knockoutPreview?.advancing_third_place_groups ??
      entry.advancing_third_place_groups ??
      undefined
    );
  }, [chosenAdvancingThirdPlaceGroups, entry.advancing_third_place_groups, knockoutPreview]);

  const knockoutPicks = useMemo(() => {
    if (!knockoutPreview) {
      return [];
    }

    return buildKnockoutPicks(knockoutPreview.predicted_bracket, knockoutPicksBySlot);
  }, [knockoutPicksBySlot, knockoutPreview]);

  const totalKnockoutMatches = useMemo(() => {
    if (!knockoutPreview) {
      return 0;
    }

    return Object.values(knockoutPreview.predicted_bracket).reduce(
      (sum, matches) => sum + (matches?.length ?? 0),
      0
    );
  }, [knockoutPreview]);

  const isBracketComplete =
    knockoutPreview !== null && knockoutPicks.length === totalKnockoutMatches;

  const entryPayload: EntryPayload = useMemo(() => {
    return {
      entry_name: entryName || "unnamed-entry",
      predictions: typedTournament.matches.map((match) => predictions[match.id]),
      advancing_third_place_groups: resolvedAdvancingThirdPlaceGroups,
      knockout_picks: knockoutPicks.length > 0 ? knockoutPicks : undefined,
    };
  }, [entryName, knockoutPicks, predictions, resolvedAdvancingThirdPlaceGroups]);

  const saveDraft = useMemo(
    () => ({
      entry_name: entryName,
      predictions: entryPayload.predictions,
      advancing_third_place_groups: resolvedAdvancingThirdPlaceGroups,
      knockout_picks: entryPayload.knockout_picks,
      knockout_preview: knockoutPreview,
      result,
      score_total: result?.total_points ?? entry.score_total ?? null,
      status: (result ? "scored" : knockoutPreview ? "knockout" : "draft") as StoredEntry["status"],
    }),
    [
      entry.score_total,
      entryName,
      entryPayload.knockout_picks,
      entryPayload.predictions,
      knockoutPreview,
      resolvedAdvancingThirdPlaceGroups,
      result,
    ]
  );

  const entrySnapshot = useMemo(
    () =>
      JSON.stringify({
        entry_name: entry.entry_name,
        predictions: entry.predictions,
        advancing_third_place_groups: entry.advancing_third_place_groups,
        knockout_picks: entry.knockout_picks,
        knockout_preview: entry.knockout_preview,
        result: entry.result,
        score_total: entry.score_total ?? null,
        status: entry.status,
      }),
    [
      entry.advancing_third_place_groups,
      entry.entry_name,
      entry.knockout_picks,
      entry.knockout_preview,
      entry.predictions,
      entry.result,
      entry.score_total,
      entry.status,
    ]
  );

  const draftSnapshot = useMemo(() => JSON.stringify(saveDraft), [saveDraft]);

  useEffect(() => {
    lastSavedSnapshotRef.current = entrySnapshot;
  }, [entrySnapshot]);

  useEffect(() => {
    if (draftSnapshot === entrySnapshot || draftSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    lastSavedSnapshotRef.current = draftSnapshot;
    onSave(saveDraft);
  }, [draftSnapshot, entrySnapshot, onSave, saveDraft]);

  useEffect(() => {
    if (phase !== "groups" || !selectedGroupId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      groupEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [phase, selectedGroupId]);

  function resetPostGroupStageState() {
    setKnockoutPreview(null);
    setKnockoutPicksBySlot({});
    setResult(null);
    setManualThirdPlaceTiebreak(null);
    setSelectedThirdPlaceGroups([]);
    setUiError(null);
    setPhase("groups");
  }

  function updateEntryName(value: string) {
    setEntryName(value);
    resetPostGroupStageState();
  }

  function updatePrediction(
    matchId: string,
    side: "home_score" | "away_score",
    value: string
  ) {
    const match = typedTournament.matches.find((current) => current.id === matchId);
    if (!match) {
      return;
    }

    const nextPredictions = {
      ...predictions,
      [matchId]: {
        ...predictions[matchId],
        [side]: value === "" ? "" : Number(value),
      },
    };

    setPredictions(nextPredictions);
    resetPostGroupStageState();

    const matchesInGroup = getMatchesForGroup(match.group_id);
    const groupIsComplete = matchesInGroup.every((groupMatch) => {
      const prediction = nextPredictions[groupMatch.id];
      return prediction.home_score !== "" && prediction.away_score !== "";
    });

    if (groupIsComplete) {
      setSelectedGroupId(null);
    }
  }

  function updateKnockoutPick(slotId: string, winnerTeam: string) {
    if (!knockoutPreview) {
      return;
    }

    setKnockoutPicksBySlot((prev) => {
      const next = { ...prev };

      if (next[slotId] === winnerTeam) {
        delete next[slotId];
      } else {
        next[slotId] = winnerTeam;
      }

      return sanitizeKnockoutPickLookup(knockoutPreview.predicted_bracket, next);
    });
  }

  function toggleThirdPlaceGroup(groupId: string) {
    if (!manualThirdPlaceTiebreak) {
      return;
    }

    setSelectedThirdPlaceGroups((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((current) => current !== groupId);
      }

      if (prev.length >= manualThirdPlaceTiebreak.slots_remaining) {
        return prev;
      }

      return [...prev, groupId].sort();
    });
  }

  async function handleApiRequest<T>(url: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entryPayload),
    });

    if (!response.ok) {
      let errorBody: unknown = null;
      let fallbackErrorText = "";

      try {
        errorBody = await response.json();
      } catch {
        fallbackErrorText = await response.text();
      }

      const detail =
        errorBody &&
        typeof errorBody === "object" &&
        "detail" in errorBody
          ? errorBody.detail
          : errorBody;

      if (isManualThirdPlaceTiebreakDetail(detail)) {
        setManualThirdPlaceTiebreak(detail);
        setSelectedThirdPlaceGroups([]);
        setUiError(detail.message);
        setKnockoutPreview(null);
        setKnockoutPicksBySlot({});
        setResult(null);
        setPhase("groups");
        return null;
      }

      const message =
        typeof detail === "string"
          ? detail
          : fallbackErrorText || "Request failed.";
      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  async function generateKnockoutBracket() {
    setUiError(null);

    if (!entryName.trim()) {
      setUiError("Please enter an entry name before continuing.");
      return;
    }

    if (!allGroupsCompleted) {
      setUiError("Finish all 12 groups before moving to the knockout stage.");
      return;
    }

    if (manualThirdPlaceTiebreak && !chosenAdvancingThirdPlaceGroups) {
      setUiError(
        `Choose ${manualThirdPlaceTiebreak.slots_remaining} advancing third-place group${
          manualThirdPlaceTiebreak.slots_remaining === 1 ? "" : "s"
        } to break the tie before generating the bracket.`
      );
      return;
    }

    try {
      setIsWorking(true);
      const data = await handleApiRequest<KnockoutBracketPreviewResponse>(
        "http://127.0.0.1:8000/api/generate-knockout-bracket"
      );

      if (!data) {
        return;
      }

      setKnockoutPreview(data);
      setKnockoutPicksBySlot((prev) =>
        sanitizeKnockoutPickLookup(data.predicted_bracket, prev)
      );
      setResult(null);
      setPhase("knockout");
      setManualThirdPlaceTiebreak(null);
      setSelectedThirdPlaceGroups(data.advancing_third_place_groups ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while generating bracket.";
      setUiError(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function scoreEntry() {
    if (!knockoutPreview) {
      setUiError("Generate the knockout bracket before scoring the entry.");
      return;
    }

    if (!isBracketComplete) {
      setUiError("Pick a winner for every knockout match before scoring the entry.");
      return;
    }

    try {
      setIsWorking(true);
      setUiError(null);
      const data = await handleApiRequest<SimulatedScoreResponse>(
        "http://127.0.0.1:8000/api/score-entry"
      );

      if (!data) {
        return;
      }

      setResult(data);
      setPhase("results");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while scoring entry.";
      setUiError(message);
    } finally {
      setIsWorking(false);
    }
  }

  function createRandomPrediction(matchId: string): MatchPrediction {
    return {
      match_id: matchId,
      home_score: Math.floor(Math.random() * 5),
      away_score: Math.floor(Math.random() * 5),
    };
  }

  function autofillGroupStage(matchIds?: string[]) {
    const idsToFill = matchIds ?? typedTournament.matches.map((match) => match.id);
    const nextPredictions = { ...predictions };

    for (const matchId of idsToFill) {
      nextPredictions[matchId] = createRandomPrediction(matchId);
    }

    setPredictions(nextPredictions);
    setSelectedGroupId(null);
    resetPostGroupStageState();
  }

  function autofillKnockoutStage() {
    if (!knockoutPreview) {
      return;
    }

    setKnockoutPicksBySlot(autofillKnockoutPickLookup(knockoutPreview.predicted_bracket));
    setUiError(null);
  }

  const selectedGroup =
    selectedGroupId === null
      ? null
      : typedTournament.groups.find((group) => group.id === selectedGroupId) ?? null;

  const knockoutStatusLabel = knockoutPreview
    ? `${knockoutPicks.length} / ${totalKnockoutMatches} knockout picks locked`
    : "Knockout stage not built yet";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#153b63_0%,#0b2442_30%,#081829_62%,#050d16_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.94),rgba(14,47,77,0.92))] p-6 text-white shadow-[0_40px_120px_rgba(2,6,23,0.5)] backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-amber-300/80">
                  Entry Builder
                </div>
                <Link
                  href="/workspace"
                  className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
                >
                  Back to Workspace
                </Link>
              </div>

              <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white">
                Build the groups first, then advance into the knockout bracket.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-100/70">
                This entry auto-saves locally to your workspace as you build it.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-cyan-100/70">
                    Entry name
                  </label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-cyan-100/35 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                    value={entryName}
                    onChange={(event) => updateEntryName(event.target.value)}
                    placeholder="alice"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <div className="text-sm text-cyan-100/55">Groups completed</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {completedGroupsCount} / {typedTournament.groups.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <div className="text-sm text-cyan-100/55">Matches filled</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {completedMatchesCount} / {typedTournament.matches.length}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {phase === "groups" && (
                  <>
                    <button
                      type="button"
                      onClick={() => autofillGroupStage()}
                      disabled={isWorking}
                      className="rounded-2xl border border-white/12 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Random Autofill Groups
                    </button>
                    <button
                      type="button"
                      onClick={generateKnockoutBracket}
                      disabled={isWorking || !allGroupsCompleted}
                      className="rounded-2xl bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-5 py-3 font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWorking ? "Building..." : "Fill Out Knockout Stage ->"}
                    </button>
                  </>
                )}

                {phase === "knockout" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhase("groups")}
                      className="rounded-2xl border border-white/12 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
                    >
                      Back to Groups
                    </button>
                    <button
                      type="button"
                      onClick={autofillKnockoutStage}
                      disabled={isWorking}
                      className="rounded-2xl border border-white/12 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Random Autofill Bracket
                    </button>
                    <button
                      type="button"
                      onClick={scoreEntry}
                      disabled={isWorking || !isBracketComplete}
                      className="rounded-2xl bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-5 py-3 font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWorking ? "Scoring..." : "Score Cumulative Entry"}
                    </button>
                  </>
                )}

                {phase === "results" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhase("knockout")}
                      className="rounded-2xl border border-white/12 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
                    >
                      Edit Knockout Picks
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhase("groups")}
                      className="rounded-2xl border border-white/12 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
                    >
                      Back to Groups
                    </button>
                  </>
                )}

                <div className="rounded-2xl border border-amber-300/40 bg-amber-300/12 px-4 py-3 text-sm text-amber-100">
                  {phase === "groups" ? "Group stage builder active" : knockoutStatusLabel}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-300/25 bg-[linear-gradient(160deg,rgba(247,222,136,0.18),rgba(228,173,53,0.14))] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/75">
                Flow
              </div>
              <div className="mt-4 space-y-4 text-sm leading-6 text-cyan-50/75">
                <p>1. Pick any group from the board and fill in all six group matches.</p>
                <p>2. Completed groups turn green and drop you back onto the 12-group board.</p>
                <p>
                  3. Once all 12 groups are complete, build the knockout stage and click the
                  winning side through every round.
                </p>
              </div>
            </div>
          </div>

          {uiError && (
            <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/12 px-4 py-3 text-sm text-red-100">
              {uiError}
            </div>
          )}
        </section>

        {manualThirdPlaceTiebreak && phase === "groups" && (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-[0_20px_60px_rgba(245,158,11,0.12)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                  Manual Tiebreak
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Choose the advancing third-place group
                  {manualThirdPlaceTiebreak.slots_remaining === 1 ? "" : "s"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                  This entry is still tied at the third-place cutoff after points, goal
                  difference, and goals for.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm text-amber-900">
                {selectedThirdPlaceGroups.length} / {manualThirdPlaceTiebreak.slots_remaining} selected
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Already locked in</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {manualThirdPlaceTiebreak.locked_group_ids.map((groupId) => (
                    <div
                      key={groupId}
                      className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white"
                    >
                      Group {groupId}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Tied candidates</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {manualThirdPlaceTiebreak.candidate_group_ids.map((groupId) => {
                    const isSelected = selectedThirdPlaceGroups.includes(groupId);
                    const isDisabled =
                      !isSelected &&
                      selectedThirdPlaceGroups.length >=
                        manualThirdPlaceTiebreak.slots_remaining;

                    return (
                      <button
                        key={groupId}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => toggleThirdPlaceGroup(groupId)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-400 hover:bg-amber-100",
                          isDisabled ? "cursor-not-allowed opacity-50" : "",
                        ].join(" ")}
                      >
                        Group {groupId}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {phase === "groups" && (
          <>
            {selectedGroup ? (
              <section ref={groupEditorRef} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)] backdrop-blur">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                      Group Editor
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Group {selectedGroup.id}
                    </h2>
                    <p className="mt-1 text-sm text-cyan-100/70">
                      Finish this group and you&apos;ll return to the 12-group board.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(null)}
                    className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    Back to 12 Groups
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      autofillGroupStage(getMatchesForGroup(selectedGroup.id).map((match) => match.id))
                    }
                    className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    Random Autofill This Group
                  </button>
                </div>

                <GroupCard
                  tournament={typedTournament}
                  group={selectedGroup}
                  matches={getMatchesForGroup(selectedGroup.id)}
                  predictions={predictions}
                  onChange={updatePrediction}
                />
              </section>
            ) : (
              <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.94))] p-6 shadow-[0_32px_90px_rgba(2,6,23,0.45)] backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                      Group Board
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Pick a group to edit
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-cyan-50/80">
                    {completedGroupsCount} of {typedTournament.groups.length} groups complete
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {typedTournament.groups.map((group) => {
                    const progress = groupProgress[group.id];

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={[
                          "rounded-[28px] border p-5 text-left transition shadow-[0_20px_50px_rgba(2,6,23,0.3)]",
                          progress.isComplete
                            ? "border-emerald-300/40 bg-[linear-gradient(145deg,rgba(10,94,76,0.95),rgba(16,185,129,0.72))] hover:brightness-105"
                            : "border-amber-300/25 bg-[linear-gradient(145deg,#fbe8a6,#e9b74e)] hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(245,158,11,0.28)]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div
                              className={[
                                "text-xs font-semibold uppercase tracking-[0.18em]",
                                progress.isComplete ? "text-emerald-50/75" : "text-slate-700/60",
                              ].join(" ")}
                            >
                              Group {group.id}
                            </div>
                            <div
                              className={[
                                "mt-2 text-lg font-semibold",
                                progress.isComplete ? "text-white" : "text-slate-950",
                              ].join(" ")}
                            >
                              Build this group
                            </div>
                          </div>
                          <div
                            className={[
                              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                              progress.isComplete
                                ? "bg-white/16 text-white"
                                : "bg-slate-950/8 text-slate-700",
                            ].join(" ")}
                          >
                            {progress.isComplete ? "Complete" : "In Progress"}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-2">
                          {group.teams.map((team) => (
                            <TeamBadge
                              key={team}
                              teamCode={team}
                              tone={progress.isComplete ? "dark" : "gold"}
                              compact
                            />
                          ))}
                        </div>

                        <div
                          className={[
                            "mt-5 rounded-2xl border px-4 py-3",
                            progress.isComplete
                              ? "border-white/10 bg-white/8"
                              : "border-black/8 bg-white/40",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "text-xs",
                              progress.isComplete ? "text-emerald-50/70" : "text-slate-600",
                            ].join(" ")}
                          >
                            Matches completed
                          </div>
                          <div
                            className={[
                              "mt-1 text-2xl font-semibold",
                              progress.isComplete ? "text-white" : "text-slate-950",
                            ].join(" ")}
                          >
                            {progress.completedMatches} / {progress.totalMatches}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {phase === "knockout" && knockoutPreview && (
          <KnockoutBracketPicker
            baseBracket={knockoutPreview.predicted_bracket}
            picksBySlot={knockoutPicksBySlot}
            onSelectWinner={updateKnockoutPick}
          />
        )}

        {phase === "results" && result && <SimulationResults result={result} />}
      </div>
    </main>
  );
}
