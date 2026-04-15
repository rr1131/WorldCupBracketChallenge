import type { Match, MatchPrediction } from "@/lib/types";

type MatchCardProps = {
  match: Match;
  prediction: MatchPrediction;
  onChange: (
    matchId: string,
    side: "home_score" | "away_score",
    value: string
  ) => void;
};

export default function MatchCard({
  match,
  prediction,
  onChange,
}: MatchCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800 p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
        {match.id}
      </div>

      <div className="grid grid-cols-[1fr_72px_72px_1fr] items-center gap-3">
        <div className="text-right font-medium">{match.home_team}</div>

        <input
          type="number"
          min="0"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center"
          value={prediction.home_score}
          onChange={(e) => onChange(match.id, "home_score", e.target.value)}
        />

        <input
          type="number"
          min="0"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center"
          value={prediction.away_score}
          onChange={(e) => onChange(match.id, "away_score", e.target.value)}
        />

        <div className="font-medium">{match.away_team}</div>
      </div>
    </div>
  );
}