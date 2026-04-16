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

export type KnockoutPickLookup = Record<string, string>;

function cloneRound(matches: KnockoutMatch[] | undefined) {
  return (matches ?? []).map((match) => ({ ...match }));
}

function deriveNextRound(
  roundName: KnockoutRoundName,
  templateMatches: KnockoutMatch[] | undefined,
  priorRoundMatches: KnockoutMatch[],
  picksBySlot: KnockoutPickLookup
) {
  return (templateMatches ?? []).map((match, index) => {
    const left = priorRoundMatches[index * 2];
    const right = priorRoundMatches[index * 2 + 1];

    return {
      ...match,
      round_name: roundName,
      home_team: left ? picksBySlot[left.slot_id] ?? null : null,
      away_team: right ? picksBySlot[right.slot_id] ?? null : null,
    };
  });
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
    const priorRoundMatches = derived[priorRoundName] ?? [];

    derived[roundName] = deriveNextRound(
      roundName,
      baseBracket[roundName],
      priorRoundMatches,
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
      derived[roundName] ?? [],
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
