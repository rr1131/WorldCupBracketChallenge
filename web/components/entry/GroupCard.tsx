import MatchCard from "@/components/entry/MatchCard";
import StandingsTable from "@/components/entry/StandingsTable";
import TeamBadge from "@/components/entry/TeamBadge";
import type {
  Group,
  Match,
  MatchPrediction,
  TournamentConfig,
} from "@/lib/types";

type GroupCardProps = {
  tournament: TournamentConfig;
  group: Group;
  matches: Match[];
  predictions: Record<string, MatchPrediction>;
  onChange: (
    matchId: string,
    side: "home_score" | "away_score",
    value: string
  ) => void;
};

export default function GroupCard({
  tournament,
  group,
  matches,
  predictions,
  onChange,
}: GroupCardProps) {
  return (
    <div className="rounded-[30px] border border-amber-300/40 bg-[linear-gradient(160deg,rgba(7,27,45,0.98),rgba(18,59,82,0.96))] p-5 shadow-[0_32px_80px_rgba(15,23,42,0.2)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/70">
            Group {group.id}
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Lock in this quartet
          </h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {group.teams.map((team) => (
            <TeamBadge key={team} teamCode={team} tone="gold" compact />
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id]}
              onChange={onChange}
            />
          ))}
        </div>

        <StandingsTable
          tournament={tournament}
          groupId={group.id}
          predictions={predictions}
        />
      </div>
    </div>
  );
}
