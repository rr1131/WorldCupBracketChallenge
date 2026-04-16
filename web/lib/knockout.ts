import type {
  KnockoutBracket,
  KnockoutMatch,
  KnockoutPick,
  KnockoutRoundName,
} from "@/lib/types";

export const KNOCKOUT_ROUNDS: KnockoutRoundName[] = [
  "R32",
  "R16",
  "QF",
  "SF",
  "FINAL",
];

const KNOCKOUT_PAIRINGS: Record<
  Exclude<KnockoutRoundName, "R32">,
  Array<{ slotId: string; homeFrom: string; awayFrom: string }>
> = {
  R16: [
    { slotId: "M89", homeFrom: "M73", awayFrom: "M75" },
    { slotId: "M90", homeFrom: "M74", awayFrom: "M77" },
    { slotId: "M91", homeFrom: "M76", awayFrom: "M78" },
    { slotId: "M92", homeFrom: "M79", awayFrom: "M80" },
    { slotId: "M93", homeFrom: "M83", awayFrom: "M84" },
    { slotId: "M94", homeFrom: "M81", awayFrom: "M82" },
    { slotId: "M95", homeFrom: "M86", awayFrom: "M88" },
    { slotId: "M96", homeFrom: "M85", awayFrom: "M87" },
  ],
  QF: [
    { slotId: "M97", homeFrom: "M89", awayFrom: "M90" },
    { slotId: "M98", homeFrom: "M93", awayFrom: "M94" },
    { slotId: "M99", homeFrom: "M91", awayFrom: "M92" },
    { slotId: "M100", homeFrom: "M95", awayFrom: "M96" },
  ],
  SF: [
    { slotId: "M101", homeFrom: "M97", awayFrom: "M98" },
    { slotId: "M102", homeFrom: "M99", awayFrom: "M100" },
  ],
  FINAL: [{ slotId: "M104", homeFrom: "M101", awayFrom: "M102" }],
};

export type KnockoutPickLookup = Record<string, string>;

function cloneRound(matches: KnockoutMatch[] | undefined) {
  return (matches ?? []).map((match) => ({ ...match }));
}

function deriveNextRound(
  roundName: KnockoutRoundName,
  templateMatches: KnockoutMatch[] | undefined,
  priorRoundLookup: Record<string, KnockoutMatch>,
  picksBySlot: KnockoutPickLookup
) {
  const templateBySlot = Object.fromEntries(
    (templateMatches ?? []).map((match) => [match.slot_id, match])
  );

  return KNOCKOUT_PAIRINGS[roundName as Exclude<KnockoutRoundName, "R32">].map(
    ({ slotId, homeFrom, awayFrom }) => {
      const templateMatch = templateBySlot[slotId];
      const left = priorRoundLookup[homeFrom];
      const right = priorRoundLookup[awayFrom];

      return {
        ...(templateMatch ?? { round_name: roundName, slot_id: slotId }),
        round_name: roundName,
        slot_id: slotId,
        home_team: left ? picksBySlot[left.slot_id] ?? null : null,
        away_team: right ? picksBySlot[right.slot_id] ?? null : null,
      };
    }
  );
}

function toLookup(matches: KnockoutMatch[] | undefined) {
  return Object.fromEntries((matches ?? []).map((match) => [match.slot_id, match]));
}

export function deriveKnockoutBracket(
  baseBracket: KnockoutBracket,
  picksBySlot: KnockoutPickLookup
): KnockoutBracket {
  const derived: KnockoutBracket = {};

  const firstRoundName = KNOCKOUT_ROUNDS[0];
  derived[firstRoundName] = cloneRound(baseBracket[firstRoundName]);

  for (let index = 1; index < KNOCKOUT_ROUNDS.length; index += 1) {
    const roundName = KNOCKOUT_ROUNDS[index];
    const priorRoundName = KNOCKOUT_ROUNDS[index - 1];
    const priorRoundLookup = toLookup(derived[priorRoundName]);

    derived[roundName] = deriveNextRound(
      roundName,
      baseBracket[roundName],
      priorRoundLookup,
      picksBySlot
    );
  }

  return derived;
}

export function sanitizeKnockoutPickLookup(
  baseBracket: KnockoutBracket,
  picksBySlot: KnockoutPickLookup
) {
  const sanitized: KnockoutPickLookup = {};
  const derived = deriveKnockoutBracket(baseBracket, sanitized);

  for (const roundName of KNOCKOUT_ROUNDS) {
    const matches = derived[roundName] ?? [];

    for (const match of matches) {
      const allowedTeams = [match.home_team, match.away_team].filter(
        (team): team is string => Boolean(team)
      );
      const selectedTeam = picksBySlot[match.slot_id];

      if (selectedTeam && allowedTeams.includes(selectedTeam)) {
        sanitized[match.slot_id] = selectedTeam;
      }
    }

    const roundIndex = KNOCKOUT_ROUNDS.indexOf(roundName);
    const nextRoundName = KNOCKOUT_ROUNDS[roundIndex + 1];
    if (!nextRoundName) {
      continue;
    }

    derived[nextRoundName] = deriveNextRound(
      nextRoundName,
      baseBracket[nextRoundName],
      toLookup(derived[roundName]),
      sanitized
    );
  }

  return sanitized;
}

export function buildKnockoutPicks(
  baseBracket: KnockoutBracket,
  picksBySlot: KnockoutPickLookup
): KnockoutPick[] {
  const sanitized = sanitizeKnockoutPickLookup(baseBracket, picksBySlot);

  return KNOCKOUT_ROUNDS.flatMap((roundName) =>
    (baseBracket[roundName] ?? []).flatMap((match) => {
      const winnerTeam = sanitized[match.slot_id];

      if (!winnerTeam) {
        return [];
      }

      return [
        {
          round_name: roundName,
          slot_id: match.slot_id,
          winner_team: winnerTeam,
        },
      ];
    })
  );
}
