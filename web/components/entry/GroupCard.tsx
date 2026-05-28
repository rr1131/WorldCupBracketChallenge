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
    <div className="rr-card-accent rounded-[30px] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
            Group {group.id}
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
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
