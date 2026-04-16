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
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-950">Group {group.id}</h2>
        <p className="text-sm text-slate-500">{group.teams.join(" • ")}</p>
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
