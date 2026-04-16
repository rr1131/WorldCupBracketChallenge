"use client";

import { useMemo } from "react";
import {
  deriveKnockoutBracket,
  KNOCKOUT_ROUNDS,
  type KnockoutPickLookup,
} from "@/lib/knockout";
import type { KnockoutBracket } from "@/lib/types";

type KnockoutBracketPickerProps = {
  baseBracket: KnockoutBracket;
  picksBySlot: KnockoutPickLookup;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
};

const ROUND_LABELS: Record<(typeof KNOCKOUT_ROUNDS)[number], string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  FINAL: "Final",
};

function formatCompletion(
  totalSelectableMatches: number,
  selectedMatches: number
) {
  if (totalSelectableMatches === 0) {
    return "Waiting for knockout bracket";
  }

  return `${selectedMatches} / ${totalSelectableMatches} winners picked`;
}

export default function KnockoutBracketPicker({
  baseBracket,
  picksBySlot,
  onSelectWinner,
}: KnockoutBracketPickerProps) {
  const derivedBracket = useMemo(
    () => deriveKnockoutBracket(baseBracket, picksBySlot),
    [baseBracket, picksBySlot]
  );

  const completion = useMemo(() => {
    let totalSelectableMatches = 0;
    let selectedMatches = 0;

    for (const roundName of KNOCKOUT_ROUNDS) {
      for (const match of derivedBracket[roundName] ?? []) {
        if (match.home_team && match.away_team) {
          totalSelectableMatches += 1;
          if (picksBySlot[match.slot_id]) {
            selectedMatches += 1;
          }
        }
      }
    }

    return formatCompletion(totalSelectableMatches, selectedMatches);
  }, [derivedBracket, picksBySlot]);

  return (
    <section className="rounded-[28px] border border-amber-200/70 bg-white/80 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Knockout Picks
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Choose winners through the bracket
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            The first simulation gives us the bracket from your group-stage predictions.
            From there, each winner you choose unlocks the next round.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {completion}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="grid min-w-max gap-4 xl:grid-cols-5">
          {KNOCKOUT_ROUNDS.map((roundName) => {
            const matches = derivedBracket[roundName] ?? [];

            return (
              <div
                key={roundName}
                className="min-w-[240px] rounded-[24px] border border-slate-200 bg-slate-50/90 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {roundName}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">
                      {ROUND_LABELS[roundName]}
                    </h3>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    {matches.length} matches
                  </div>
                </div>

                <div className="space-y-3">
                  {matches.map((match) => {
                    const teams = [match.home_team, match.away_team];
                    const isReady = Boolean(match.home_team && match.away_team);
                    const selectedWinner = picksBySlot[match.slot_id];

                    return (
                      <article
                        key={match.slot_id}
                        className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {match.slot_id}
                          </div>
                          {selectedWinner && (
                            <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                              Picked
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          {teams.map((team, index) => {
                            const teamName =
                              team ??
                              (index === 0 ? "Awaiting previous winner" : "Awaiting previous winner");
                            const isSelected = teamName === selectedWinner;

                            return (
                              <button
                                key={`${match.slot_id}-${index}`}
                                type="button"
                                disabled={!team || !isReady}
                                onClick={() => team && onSelectWinner(match.slot_id, team)}
                                className={[
                                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                                  !team || !isReady
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                    : isSelected
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
                                      : "border-slate-200 bg-white text-slate-800 hover:border-amber-300 hover:bg-amber-50",
                                ].join(" ")}
                              >
                                <span className="font-medium">{teamName}</span>
                                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                  {isSelected ? "Winner" : "Select"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}

                  {matches.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500">
                      This round will appear once the backend returns the knockout slots.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
