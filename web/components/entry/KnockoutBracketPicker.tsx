"use client";

import { useMemo } from "react";
import FlagIcon from "@/components/entry/FlagIcon";
import {
  deriveKnockoutBracket,
  type KnockoutPickLookup,
} from "@/lib/knockout";
import { getTeamMetadata } from "@/lib/team-metadata";
import type { KnockoutBracket } from "@/lib/types";

type KnockoutBracketPickerProps = {
  baseBracket: KnockoutBracket;
  picksBySlot: KnockoutPickLookup;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
};

type SlotPlacement = {
  slotId: string;
  row: number;
  span: number;
};

const LEFT_STAGE_LABELS = ["Round of 32", "R16", "QF", "SF"];
const RIGHT_STAGE_LABELS = ["SF", "QF", "R16", "Round of 32"];

const LEFT_LAYOUT: SlotPlacement[][] = [
  [
    { slotId: "M73", row: 1, span: 1 },
    { slotId: "M75", row: 2, span: 1 },
    { slotId: "M74", row: 3, span: 1 },
    { slotId: "M77", row: 4, span: 1 },
    { slotId: "M83", row: 5, span: 1 },
    { slotId: "M84", row: 6, span: 1 },
    { slotId: "M81", row: 7, span: 1 },
    { slotId: "M82", row: 8, span: 1 },
  ],
  [
    { slotId: "M89", row: 1, span: 2 },
    { slotId: "M90", row: 3, span: 2 },
    { slotId: "M93", row: 5, span: 2 },
    { slotId: "M94", row: 7, span: 2 },
  ],
  [
    { slotId: "M97", row: 2, span: 2 },
    { slotId: "M98", row: 6, span: 2 },
  ],
  [{ slotId: "M101", row: 3, span: 4 }],
];

const RIGHT_LAYOUT: SlotPlacement[][] = [
  [{ slotId: "M102", row: 3, span: 4 }],
  [
    { slotId: "M99", row: 2, span: 2 },
    { slotId: "M100", row: 6, span: 2 },
  ],
  [
    { slotId: "M91", row: 1, span: 2 },
    { slotId: "M92", row: 3, span: 2 },
    { slotId: "M96", row: 5, span: 2 },
    { slotId: "M95", row: 7, span: 2 },
  ],
  [
    { slotId: "M76", row: 1, span: 1 },
    { slotId: "M78", row: 2, span: 1 },
    { slotId: "M79", row: 3, span: 1 },
    { slotId: "M80", row: 4, span: 1 },
    { slotId: "M85", row: 5, span: 1 },
    { slotId: "M87", row: 6, span: 1 },
    { slotId: "M86", row: 7, span: 1 },
    { slotId: "M88", row: 8, span: 1 },
  ],
];

function flattenBracket(baseBracket: KnockoutBracket) {
  return Object.fromEntries(
    Object.values(baseBracket)
      .flatMap((matches) => matches ?? [])
      .map((match) => [match.slot_id, match])
  );
}

function TeamOption({
  slotId,
  side,
  team,
  selectedWinner,
  onSelectWinner,
}: {
  slotId: string;
  side: "left" | "right";
  team: string | null;
  selectedWinner?: string;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
}) {
  const isSelected = Boolean(team && team === selectedWinner);
  const isDisabled = !team;

  if (!team) {
    return (
      <div className="flex h-8 items-center rounded-xl border border-white/8 bg-white/6 px-2 text-[11px] uppercase tracking-[0.12em] text-cyan-50/35">
        Awaiting prior winner
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectWinner(slotId, team)}
      disabled={isDisabled}
      className={[
        "flex h-8 items-center gap-2 rounded-xl border px-2 transition",
        side === "left" ? "justify-start text-left" : "justify-end text-right",
        isSelected
          ? "border-amber-300 bg-[linear-gradient(135deg,#f7de88,#e4ad35)] text-slate-950 shadow-[0_10px_25px_rgba(245,158,11,0.28)]"
          : "border-white/10 bg-[#0e3143] text-white hover:border-cyan-300/35 hover:bg-[#143c51]",
      ].join(" ")}
    >
      {side === "left" && <FlagIcon teamCode={team} className="h-4 w-6 rounded-sm" />}
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">
        {getTeamMetadata(team).code}
      </span>
      {side === "right" && <FlagIcon teamCode={team} className="h-4 w-6 rounded-sm" />}
    </button>
  );
}

function MatchNode({
  slotId,
  row,
  span,
  side,
  teams,
  selectedWinner,
  onSelectWinner,
}: {
  slotId: string;
  row: number;
  span: number;
  side: "left" | "right" | "center";
  teams: [string | null, string | null];
  selectedWinner?: string;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
}) {
  const connectorClass =
    side === "left"
      ? "after:absolute after:right-[-12px] after:top-1/2 after:h-px after:w-3 after:bg-pink-400/70"
      : side === "right"
        ? "before:absolute before:left-[-12px] before:top-1/2 before:h-px before:w-3 before:bg-pink-400/70"
        : "";

  return (
    <div
      className="relative"
      style={{ gridRow: `${row} / span ${span}` }}
    >
      <div
        className={[
          "relative flex h-full min-h-[66px] flex-col justify-center rounded-[22px] border border-cyan-300/10 bg-[linear-gradient(180deg,#0a2535,#0f3143)] p-2 shadow-[0_14px_34px_rgba(2,6,23,0.42)]",
          connectorClass,
        ].join(" ")}
      >
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45">
          {slotId}
        </div>

        <div className="space-y-1.5">
          <TeamOption
            slotId={slotId}
            side={side === "right" ? "right" : "left"}
            team={teams[0]}
            selectedWinner={selectedWinner}
            onSelectWinner={onSelectWinner}
          />
          <TeamOption
            slotId={slotId}
            side={side === "right" ? "right" : "left"}
            team={teams[1]}
            selectedWinner={selectedWinner}
            onSelectWinner={onSelectWinner}
          />
        </div>
      </div>
    </div>
  );
}

function BracketSide({
  layout,
  labels,
  bracketLookup,
  picksBySlot,
  onSelectWinner,
}: {
  layout: SlotPlacement[][];
  labels: string[];
  bracketLookup: Record<string, { home_team: string | null; away_team: string | null }>;
  picksBySlot: KnockoutPickLookup;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1.45fr_1.15fr_0.95fr_0.8fr] gap-3">
        {labels.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/55"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid h-[70vh] min-h-[620px] grid-cols-[1.45fr_1.15fr_0.95fr_0.8fr] grid-rows-8 gap-x-3 gap-y-2">
        {layout.flatMap((column, columnIndex) =>
          column.map((placement) => {
            const match = bracketLookup[placement.slotId];
            return (
              <div key={placement.slotId} style={{ gridColumn: columnIndex + 1 }}>
                <MatchNode
                  slotId={placement.slotId}
                  row={placement.row}
                  span={placement.span}
                  side={labels[0] === "SF" ? "right" : "left"}
                  teams={[match?.home_team ?? null, match?.away_team ?? null]}
                  selectedWinner={picksBySlot[placement.slotId]}
                  onSelectWinner={onSelectWinner}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
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

  const bracketLookup = useMemo(() => flattenBracket(derivedBracket), [derivedBracket]);
  const finalMatch = bracketLookup.M104;
  const champion = picksBySlot.M104 ?? null;

  const completion = useMemo(() => {
    const total = Object.keys(bracketLookup).length;
    const picked = Object.keys(picksBySlot).length;
    return `${picked} / ${total} winners picked`;
  }, [bracketLookup, picksBySlot]);

  return (
    <section className="rounded-[34px] border border-cyan-300/12 bg-[linear-gradient(135deg,#071c2e,#0b2740_48%,#061524)] p-6 text-white shadow-[0_40px_120px_rgba(2,6,23,0.55)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/75">
            Knockout Stage
          </div>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            Fill the entire bracket on one screen
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/65">
            The outer edges hold the Round of 32, each winner pulls the next round into
            place, and the championship matchup meets in the center.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/12 px-4 py-3 text-sm font-medium text-amber-100">
          {completion}
        </div>
      </div>

      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_170px_minmax(0,1fr)] xl:items-start xl:gap-4">
        <BracketSide
          layout={LEFT_LAYOUT}
          labels={LEFT_STAGE_LABELS}
          bracketLookup={bracketLookup}
          picksBySlot={picksBySlot}
          onSelectWinner={onSelectWinner}
        />

        <div className="flex h-[70vh] min-h-[620px] flex-col justify-center">
          <div className="space-y-4">
            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/55">
              Final
            </div>

            <MatchNode
              slotId="M104"
              row={1}
              span={1}
              side="center"
              teams={[finalMatch?.home_team ?? null, finalMatch?.away_team ?? null]}
              selectedWinner={picksBySlot.M104}
              onSelectWinner={onSelectWinner}
            />

            <div className="rounded-[28px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(247,222,136,0.16),rgba(247,222,136,0.06))] px-4 py-5 text-center shadow-[0_16px_40px_rgba(245,158,11,0.14)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
                Winner
              </div>
              {champion ? (
                <div className="mt-3 flex flex-col items-center gap-3">
                  <FlagIcon teamCode={champion} className="h-10 w-14 rounded-lg" />
                  <div className="text-2xl font-semibold tracking-[0.16em] text-white">
                    {getTeamMetadata(champion).code}
                  </div>
                  <div className="text-xs uppercase tracking-[0.24em] text-amber-100/70">
                    {getTeamMetadata(champion).name}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-cyan-100/45">Pick the final winner</div>
              )}
            </div>
          </div>
        </div>

        <BracketSide
          layout={RIGHT_LAYOUT}
          labels={RIGHT_STAGE_LABELS}
          bracketLookup={bracketLookup}
          picksBySlot={picksBySlot}
          onSelectWinner={onSelectWinner}
        />
      </div>

      <div className="space-y-6 xl:hidden">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          The full no-scroll bracket is optimized for desktop widths. On smaller screens,
          the rounds stack for readability.
        </div>

        {Object.entries(derivedBracket).map(([roundName, matches]) => (
          <div key={roundName} className="rounded-[24px] border border-cyan-300/10 bg-[#0b2435] p-4">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/55">
              {roundName}
            </div>
            <div className="grid gap-3">
              {(matches ?? []).map((match) => (
                <MatchNode
                  key={match.slot_id}
                  slotId={match.slot_id}
                  row={1}
                  span={1}
                  side="center"
                  teams={[match.home_team, match.away_team]}
                  selectedWinner={picksBySlot[match.slot_id]}
                  onSelectWinner={onSelectWinner}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
