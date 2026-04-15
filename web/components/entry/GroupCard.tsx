import MatchCard from "@/components/entry/MatchCard";
import StandingsTable from "@/components/entry/StandingsTable";
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Group {group.id}</h2>
        <p className="text-sm text-slate-400">{group.teams.join(" • ")}</p>
      </div>

      <div className="space-y-3">
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
  );
}