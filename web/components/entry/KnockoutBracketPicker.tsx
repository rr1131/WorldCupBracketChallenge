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

type SourceLookup = Record<string, [string | null, string | null]>;

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

const DESKTOP_BRACKET_HEIGHT_CLASS = "h-[76vh] min-h-[680px]";
const LEFT_SIDE_COLUMNS_CLASS = "grid-cols-[158px_140px_136px_120px]";
const RIGHT_SIDE_COLUMNS_CLASS = "grid-cols-[120px_136px_140px_158px]";
const CENTER_COLUMN_WIDTH_CLASS = "w-[168px]";

function flattenBracket(baseBracket: KnockoutBracket) {
  return Object.fromEntries(
    Object.values(baseBracket)
      .flatMap((matches) => matches ?? [])
      .map((match) => [match.slot_id, match])
  );
}

function getPlaceholderLabel(slotId: string) {
  return `W ${slotId}`;
}

function getRoundForSlot(slotId: string) {
  const matchNumber = Number(slotId.replace("M", ""));

  if (matchNumber >= 73 && matchNumber <= 88) {
    return "R32";
  }

  if (matchNumber >= 89 && matchNumber <= 96) {
    return "R16";
  }

  if (matchNumber >= 97 && matchNumber <= 100) {
    return "QF";
  }

  if (matchNumber >= 101 && matchNumber <= 102) {
    return "SF";
  }

  return "FINAL";
}

function TeamOption({
  slotId,
  side,
  team,
  placeholderSlotId,
  selectedWinner,
  onSelectWinner,
}: {
  slotId: string;
  side: "left" | "right";
  team: string | null;
  placeholderSlotId?: string;
  selectedWinner?: string;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
}) {
  const isSelected = Boolean(team && team === selectedWinner);
  const isDisabled = !team;

  if (!team) {
    return (
      <div
        className={[
          "flex h-7 w-full items-center rounded-lg border border-[rgba(146,86,76,0.16)] bg-[#fff8f7] px-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b7d77]",
          side === "left" ? "justify-start text-left" : "justify-end text-right",
        ].join(" ")}
      >
        {placeholderSlotId ? getPlaceholderLabel(placeholderSlotId) : "TBD"}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectWinner(slotId, team)}
      disabled={isDisabled}
      className={[
        "flex h-7 w-full items-center gap-1 rounded-lg border px-1.5 transition",
        side === "left" ? "justify-start text-left" : "justify-end text-right",
        isSelected
          ? "border-[rgba(196,52,64,0.28)] bg-[linear-gradient(135deg,#fdeef0,#f7d7db)] text-[#611019] shadow-[0_10px_25px_rgba(142,31,41,0.14)]"
          : "border-[rgba(146,86,76,0.14)] bg-white text-[#251a18] hover:border-[rgba(196,52,64,0.22)] hover:bg-[#fff4f3]",
      ].join(" ")}
    >
      {side === "left" && <FlagIcon teamCode={team} className="h-3.5 w-4.5 rounded-sm" />}
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">
        {getTeamMetadata(team).code}
      </span>
      {side === "right" && <FlagIcon teamCode={team} className="h-3.5 w-4.5 rounded-sm" />}
    </button>
  );
}

function MatchNode({
  slotId,
  side,
  teams,
  sourceSlots,
  selectedWinner,
  onSelectWinner,
}: {
  slotId: string;
  side: "left" | "right" | "center";
  teams: [string | null, string | null];
  sourceSlots?: [string | null, string | null];
  selectedWinner?: string;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
}) {
  const roundName = getRoundForSlot(slotId);
  const connectorClass =
    side === "left"
      ? "after:absolute after:right-[-12px] after:top-1/2 after:h-px after:w-3 after:bg-[#d48a92]"
      : side === "right"
        ? "before:absolute before:left-[-12px] before:top-1/2 before:h-px before:w-3 before:bg-[#d48a92]"
        : "";
  const cardHeightClass =
    roundName === "R32"
      ? "h-full min-h-[64px]"
      : roundName === "R16"
        ? "h-[98px]"
        : roundName === "QF"
          ? "h-[92px]"
          : roundName === "SF"
            ? "h-[84px]"
            : "h-[104px]";

  return (
    <div className="relative flex h-full items-center">
      <div
        className={[
          "relative flex w-full flex-col justify-center overflow-hidden rounded-[22px] border border-[rgba(146,86,76,0.16)] bg-[linear-gradient(180deg,#fffefe,#fff6f4)] p-1.5 shadow-[0_14px_34px_rgba(124,31,40,0.08)]",
          cardHeightClass,
          connectorClass,
        ].join(" ")}
      >
        <div className="space-y-1">
          <TeamOption
            slotId={slotId}
            side={side === "right" ? "right" : "left"}
            team={teams[0]}
            placeholderSlotId={sourceSlots?.[0] ?? undefined}
            selectedWinner={selectedWinner}
            onSelectWinner={onSelectWinner}
          />
          <TeamOption
            slotId={slotId}
            side={side === "right" ? "right" : "left"}
            team={teams[1]}
            placeholderSlotId={sourceSlots?.[1] ?? undefined}
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
  side,
  bracketLookup,
  sourceLookup,
  picksBySlot,
  onSelectWinner,
}: {
  layout: SlotPlacement[][];
  labels: string[];
  side: "left" | "right";
  bracketLookup: Record<string, { home_team: string | null; away_team: string | null }>;
  sourceLookup: SourceLookup;
  picksBySlot: KnockoutPickLookup;
  onSelectWinner: (slotId: string, winnerTeam: string) => void;
}) {
  const columnClass =
    side === "left" ? LEFT_SIDE_COLUMNS_CLASS : RIGHT_SIDE_COLUMNS_CLASS;

  return (
    <div className={["w-fit shrink-0 space-y-3", side === "right" ? "ml-auto" : ""].join(" ")}>
      <div className={["grid gap-x-2.5 gap-y-3", columnClass].join(" ")}>
        {labels.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e1f29]/70"
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className={[
          "grid grid-rows-8 gap-x-2.5 gap-y-2",
          columnClass,
          DESKTOP_BRACKET_HEIGHT_CLASS,
        ].join(" ")}
      >
        {layout.flatMap((column, columnIndex) =>
          column.map((placement) => {
            const match = bracketLookup[placement.slotId];
            return (
              <div
                key={placement.slotId}
                style={{
                  gridColumn: columnIndex + 1,
                  gridRow: `${placement.row} / span ${placement.span}`,
                }}
              >
                <MatchNode
                  slotId={placement.slotId}
                  side={side}
                  teams={[match?.home_team ?? null, match?.away_team ?? null]}
                  sourceSlots={sourceLookup[placement.slotId]}
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
  const sourceLookup = useMemo<SourceLookup>(
    () => ({
      M73: [null, null],
      M74: [null, null],
      M75: [null, null],
      M76: [null, null],
      M77: [null, null],
      M78: [null, null],
      M79: [null, null],
      M80: [null, null],
      M81: [null, null],
      M82: [null, null],
      M83: [null, null],
      M84: [null, null],
      M85: [null, null],
      M86: [null, null],
      M87: [null, null],
      M88: [null, null],
      M89: ["M73", "M75"],
      M90: ["M74", "M77"],
      M91: ["M76", "M78"],
      M92: ["M79", "M80"],
      M93: ["M83", "M84"],
      M94: ["M81", "M82"],
      M95: ["M86", "M88"],
      M96: ["M85", "M87"],
      M97: ["M89", "M90"],
      M98: ["M93", "M94"],
      M99: ["M91", "M92"],
      M100: ["M95", "M96"],
      M101: ["M97", "M98"],
      M102: ["M99", "M100"],
      M104: ["M101", "M102"],
    }),
    []
  );

  const completion = useMemo(() => {
    const total = Object.keys(bracketLookup).length;
    const picked = Object.keys(picksBySlot).length;
    return `${picked} / ${total} winners picked`;
  }, [bracketLookup, picksBySlot]);

  return (
    <section className="rr-frame rounded-[34px] p-6 text-[#251a18] xl:relative xl:left-1/2 xl:w-[min(1480px,calc(100vw-2rem))] xl:max-w-none xl:-translate-x-1/2 xl:overflow-hidden">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
            Knockout Stage
          </div>
          <h2 className="mt-2 text-3xl font-semibold text-[#251a18]">
            Fill the entire bracket on one screen
          </h2>
          <p className="rr-body mt-2 max-w-3xl text-sm leading-6">
            The outer edges hold the Round of 32, each winner pulls the next round into
            place, and the championship matchup meets in the center.
          </p>
        </div>

        <div className="rr-badge rounded-2xl px-4 py-3 text-sm font-medium">
          {completion}
        </div>
      </div>

      <div className="hidden xl:flex xl:items-start xl:justify-center xl:gap-4">
        <BracketSide
          layout={LEFT_LAYOUT}
          labels={LEFT_STAGE_LABELS}
          side="left"
          bracketLookup={bracketLookup}
          sourceLookup={sourceLookup}
          picksBySlot={picksBySlot}
          onSelectWinner={onSelectWinner}
        />

        <div
          className={[
            "flex shrink-0 flex-col justify-center",
            CENTER_COLUMN_WIDTH_CLASS,
            DESKTOP_BRACKET_HEIGHT_CLASS,
          ].join(" ")}
        >
          <div className="-mt-1 space-y-3">
            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e1f29]/70">
              Final
            </div>

            <MatchNode
              slotId="M104"
              side="center"
              teams={[finalMatch?.home_team ?? null, finalMatch?.away_team ?? null]}
              sourceSlots={sourceLookup.M104}
              selectedWinner={picksBySlot.M104}
              onSelectWinner={onSelectWinner}
            />

            <div className="rounded-[28px] border border-[rgba(196,52,64,0.18)] bg-[linear-gradient(180deg,#fff7f7,#f9e3e4)] px-3.5 py-4 text-center shadow-[0_16px_40px_rgba(142,31,41,0.1)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8e1f29]/72">
                Winner
              </div>
              {champion ? (
                <div className="mt-2.5 flex flex-col items-center gap-2.5">
                  <FlagIcon teamCode={champion} className="h-9 w-12 rounded-lg" />
                  <div className="text-[1.35rem] font-semibold tracking-[0.14em] text-[#611019]">
                    {getTeamMetadata(champion).code}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#8e1f29]/72">
                    {getTeamMetadata(champion).name}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#9b7d77]">Pick the final winner</div>
              )}
            </div>
          </div>
        </div>

        <BracketSide
          layout={RIGHT_LAYOUT}
          labels={RIGHT_STAGE_LABELS}
          side="right"
          bracketLookup={bracketLookup}
          sourceLookup={sourceLookup}
          picksBySlot={picksBySlot}
          onSelectWinner={onSelectWinner}
        />
      </div>

      <div className="space-y-6 xl:hidden">
        <div className="rr-badge rounded-2xl px-4 py-3 text-sm">
          The full no-scroll bracket is optimized for desktop widths. On smaller screens,
          the rounds stack for readability.
        </div>

        {Object.entries(derivedBracket).map(([roundName, matches]) => (
          <div key={roundName} className="rr-card rounded-[24px] p-4">
            <div className="rr-kicker mb-4 text-xs font-semibold uppercase tracking-[0.24em]">
              {roundName}
            </div>
            <div className="grid gap-3">
              {(matches ?? []).map((match) => (
                <MatchNode
                  key={match.slot_id}
                  slotId={match.slot_id}
                  side="center"
                  teams={[match.home_team, match.away_team]}
                  sourceSlots={sourceLookup[match.slot_id]}
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
