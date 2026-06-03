"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GroupCard from "@/components/entry/GroupCard";
import KnockoutBracketPicker from "@/components/entry/KnockoutBracketPicker";
import { buildApiUrl } from "@/lib/api";
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
  TournamentConfig,
} from "@/lib/types";

const typedTournament = tournament as TournamentConfig;

type BuildPhase = "groups" | "knockout";

type ManualThirdPlaceTiebreakDetail = {
  code: "manual_third_place_tiebreak_required";
  message: string;
  locked_group_ids: string[];
  candidate_group_ids: string[];
  slots_remaining: number;
};

type EntryBuilderProps = {
  entry: StoredEntry;
  onDelete?: () => void;
  onSave: (updates: Partial<StoredEntry>) => Promise<StoredEntry | null>;
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

export default function EntryBuilder({ entry, onDelete, onSave }: EntryBuilderProps) {
  const router = useRouter();
  const groupEditorRef = useRef<HTMLElement | null>(null);
  const pendingSaveRef = useRef<{ snapshot: string; updates: Partial<StoredEntry> } | null>(null);
  const activeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<BuildPhase>(() => {
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

  const entryPayload: EntryPayload = useMemo(() => {
    return {
      entry_name: entryName || "unnamed-entry",
      predictions: typedTournament.matches.map((match) => predictions[match.id]),
      advancing_third_place_groups: resolvedAdvancingThirdPlaceGroups,
      knockout_picks: knockoutPicks.length > 0 ? knockoutPicks : undefined,
    };
  }, [entryName, knockoutPicks, predictions, resolvedAdvancingThirdPlaceGroups]);

  const entryPredictionsSnapshot = useMemo(() => JSON.stringify(entry.predictions), [entry.predictions]);
  const localPredictionsSnapshot = useMemo(
    () => JSON.stringify(entryPayload.predictions),
    [entryPayload.predictions]
  );
  const entryThirdPlaceSnapshot = useMemo(
    () => JSON.stringify(entry.advancing_third_place_groups ?? null),
    [entry.advancing_third_place_groups]
  );
  const localThirdPlaceSnapshot = useMemo(
    () => JSON.stringify(resolvedAdvancingThirdPlaceGroups ?? null),
    [resolvedAdvancingThirdPlaceGroups]
  );
  const entryKnockoutPicksSnapshot = useMemo(
    () => JSON.stringify(entry.knockout_picks ?? null),
    [entry.knockout_picks]
  );
  const localKnockoutPicksSnapshot = useMemo(
    () => JSON.stringify(entryPayload.knockout_picks ?? null),
    [entryPayload.knockout_picks]
  );

  const persistedUpdates = useMemo(() => {
    const updates: Partial<StoredEntry> = {};

    if (entryName !== entry.entry_name) {
      updates.entry_name = entryName;
    }

    if (localPredictionsSnapshot !== entryPredictionsSnapshot) {
      updates.predictions = entryPayload.predictions;
    }

    if (localThirdPlaceSnapshot !== entryThirdPlaceSnapshot) {
      updates.advancing_third_place_groups = resolvedAdvancingThirdPlaceGroups;
    }

    if (localKnockoutPicksSnapshot !== entryKnockoutPicksSnapshot) {
      updates.knockout_picks = entryPayload.knockout_picks;
    }

    return updates;
  }, [
    entry.entry_name,
    entryKnockoutPicksSnapshot,
    entryName,
    entryPayload.knockout_picks,
    entryPayload.predictions,
    entryPredictionsSnapshot,
    entryThirdPlaceSnapshot,
    localKnockoutPicksSnapshot,
    localPredictionsSnapshot,
    localThirdPlaceSnapshot,
    resolvedAdvancingThirdPlaceGroups,
  ]);

  const persistedSnapshot = useMemo(() => JSON.stringify(persistedUpdates), [persistedUpdates]);
  const hasPersistedUpdates = Object.keys(persistedUpdates).length > 0;

  const flushPendingSaves = useCallback(async () => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (activeSavePromiseRef.current) {
      return activeSavePromiseRef.current;
    }

    const run = (async () => {
      let didFail = false;

      while (pendingSaveRef.current) {
        const pendingSave = pendingSaveRef.current;
        pendingSaveRef.current = null;

        const savedEntry = await onSave(pendingSave.updates);
        if (!savedEntry) {
          didFail = true;
          setUiError("We couldn't save this entry right now. Please try again.");
          break;
        }
      }

      activeSavePromiseRef.current = null;
      return !didFail;
    })();

    activeSavePromiseRef.current = run;
    return run;
  }, [onSave]);

  useEffect(() => {
    if (!hasPersistedUpdates) {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      pendingSaveRef.current = {
        snapshot: persistedSnapshot,
        updates: persistedUpdates,
      };
      void flushPendingSaves();
    }, 700);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [flushPendingSaves, hasPersistedUpdates, persistedSnapshot, persistedUpdates]);

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
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
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
      if (hasPersistedUpdates) {
        pendingSaveRef.current = {
          snapshot: persistedSnapshot,
          updates: persistedUpdates,
        };
        const saved = await flushPendingSaves();
        if (!saved) {
          return;
        }
      }

      const data = await handleApiRequest<KnockoutBracketPreviewResponse>(
        buildApiUrl(`/api/entries/${entry.id}/knockout-preview`)
      );

      if (!data) {
        return;
      }

      setKnockoutPreview(data);
      setKnockoutPicksBySlot((prev) =>
        sanitizeKnockoutPickLookup(data.predicted_bracket, prev)
      );
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

  async function handleBackToWizard() {
    if (hasPersistedUpdates) {
      pendingSaveRef.current = {
        snapshot: persistedSnapshot,
        updates: persistedUpdates,
      };
      const saved = await flushPendingSaves();
      if (!saved) {
        return;
      }
    }

    router.push("/workspace");
  }

  const selectedGroup =
    selectedGroupId === null
      ? null
      : typedTournament.groups.find((group) => group.id === selectedGroupId) ?? null;

  return (
    <main className="rr-page min-h-screen px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rr-frame rounded-[32px] p-6 text-[#251a18] backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.34em]">
                  Entry Builder
                </div>
                <button
                  type="button"
                  onClick={() => void handleBackToWizard()}
                  disabled={isWorking}
                  className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                >
                  Back to My Wizard
                </button>
              </div>

              <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-[#251a18]">
                Build the groups first, then advance into the knockout bracket.
              </h1>
              <p className="rr-body mt-3 max-w-3xl text-sm leading-6">
                This entry auto-saves to your account as you build it, and you can save it
                manually before heading back to My Wizard. Official points will arrive
                automatically from live match results.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                <div>
                  <label className="rr-body mb-2 block text-sm font-medium">
                    Entry name
                  </label>
                  <input
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                    value={entryName}
                    onChange={(event) => updateEntryName(event.target.value)}
                    placeholder="alice"
                  />
                </div>

                <div className="rr-card-soft rounded-2xl px-4 py-3">
                  <div className="rr-soft text-sm">Groups completed</div>
                  <div className="mt-1 text-2xl font-semibold text-[#251a18]">
                    {completedGroupsCount} / {typedTournament.groups.length}
                  </div>
                </div>

                <div className="rr-card-soft rounded-2xl px-4 py-3">
                  <div className="rr-soft text-sm">Matches filled</div>
                  <div className="mt-1 text-2xl font-semibold text-[#251a18]">
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
                      className="rr-secondary-btn rounded-2xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Random Autofill Groups
                    </button>
                    <button
                      type="button"
                      onClick={generateKnockoutBracket}
                      disabled={isWorking || !allGroupsCompleted}
                      className="rr-primary-btn rounded-2xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rr-secondary-btn rounded-2xl px-5 py-3 font-semibold"
                    >
                      Back to Groups
                    </button>
                    <button
                      type="button"
                      onClick={autofillKnockoutStage}
                      disabled={isWorking}
                      className="rr-secondary-btn rounded-2xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Random Autofill Bracket
                    </button>
                  </>
                )}

                {onDelete ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rr-secondary-btn rounded-2xl px-5 py-3 font-semibold"
                  >
                    Delete Entry
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rr-card-accent rounded-[28px] p-5">
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                Flow
              </div>
              <div className="rr-body mt-4 space-y-4 text-sm leading-6">
                <p>1. Pick any group from the board and fill in all six group matches.</p>
                <p>2. Completed groups turn green and drop you back onto the 12-group board.</p>
                <p>
                  3. Once all 12 groups are complete, build the knockout stage and click the
                  winning side through every round.
                </p>
                <p>4. Entry scores update when official results come in.</p>
              </div>
            </div>
          </div>

          {uiError && (
            <div className="rr-error mt-4 rounded-2xl px-4 py-3 text-sm">
              {uiError}
            </div>
          )}
        </section>

        {manualThirdPlaceTiebreak && phase === "groups" && (
          <section className="rr-card-accent rounded-[28px] p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
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

              <div className="rr-badge rounded-2xl px-4 py-3 text-sm">
                {selectedThirdPlaceGroups.length} / {manualThirdPlaceTiebreak.slots_remaining} selected
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rr-card rounded-2xl p-4">
                <div className="text-sm font-semibold text-slate-900">Already locked in</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {manualThirdPlaceTiebreak.locked_group_ids.map((groupId) => (
                    <div
                      key={groupId}
                      className="rounded-full bg-[#8e1f29] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white"
                    >
                      Group {groupId}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rr-card rounded-2xl p-4">
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
                            ? "border-[rgba(196,52,64,0.26)] bg-[#fdeef0] text-[#611019]"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[rgba(196,52,64,0.28)] hover:bg-[#fdeef0]",
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
                <div className="rr-card rounded-[28px] p-5 backdrop-blur">
                  <div>
                    <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                      Group Editor
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
                      Group {selectedGroup.id}
                    </h2>
                    <p className="rr-body mt-1 text-sm">
                      Finish this group and you&apos;ll return to the 12-group board.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(null)}
                    className="rr-secondary-btn rounded-2xl px-4 py-3 text-sm font-semibold"
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
                    className="rr-secondary-btn rounded-2xl px-4 py-3 text-sm font-semibold"
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
              <section className="rr-frame rounded-[32px] p-6 backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                      Group Board
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
                      Pick a group to edit
                    </h2>
                  </div>
                  <div className="rr-inline-note rounded-2xl px-4 py-3 text-sm">
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
                            ? "border-[rgba(196,52,64,0.22)] bg-[linear-gradient(145deg,#fff4f4,#f7d7db)] hover:brightness-105"
                            : "border-[rgba(146,86,76,0.18)] bg-[linear-gradient(145deg,#fffdfc,#f8efec)] hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(124,31,40,0.12)]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div
                              className={[
                                "text-xs font-semibold uppercase tracking-[0.18em]",
                                progress.isComplete ? "text-[#8e1f29]/80" : "text-slate-700/60",
                              ].join(" ")}
                            >
                              Group {group.id}
                            </div>
                            <div
                              className={[
                                "mt-2 text-lg font-semibold",
                                progress.isComplete ? "text-[#251a18]" : "text-slate-950",
                              ].join(" ")}
                            >
                              Build this group
                            </div>
                          </div>
                          <div
                            className={[
                              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                              progress.isComplete
                                ? "bg-[#fdeef0] text-[#8e1f29]"
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
                              tone={progress.isComplete ? "gold" : "dark"}
                              compact
                            />
                          ))}
                        </div>

                        <div
                          className={[
                            "mt-5 rounded-2xl border px-4 py-3",
                            progress.isComplete
                              ? "border-[rgba(196,52,64,0.16)] bg-white/90"
                              : "border-black/8 bg-white/40",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "text-xs",
                              progress.isComplete ? "text-[#8e1f29]/75" : "text-slate-600",
                            ].join(" ")}
                          >
                            Matches completed
                          </div>
                          <div
                            className={[
                              "mt-1 text-2xl font-semibold",
                              progress.isComplete ? "text-[#251a18]" : "text-slate-950",
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
      </div>
    </main>
  );
}
