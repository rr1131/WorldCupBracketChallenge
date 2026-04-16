import TeamBadge from "@/components/entry/TeamBadge";
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
    <div className="rounded-[22px] border border-[#193a4f]/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {match.id}
        </div>
        <div className="rounded-full bg-slate-950/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
          Matchday
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_40px_40px_minmax(0,1fr)] items-center gap-2">
        <TeamBadge teamCode={match.home_team} compact />

        <input
          type="number"
          min="0"
          className="h-10 rounded-xl border border-slate-200 bg-white px-1 text-center text-sm font-semibold text-slate-950 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          value={prediction.home_score}
          onChange={(e) => onChange(match.id, "home_score", e.target.value)}
        />

        <input
          type="number"
          min="0"
          className="h-10 rounded-xl border border-slate-200 bg-white px-1 text-center text-sm font-semibold text-slate-950 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          value={prediction.away_score}
          onChange={(e) => onChange(match.id, "away_score", e.target.value)}
        />

        <TeamBadge teamCode={match.away_team} compact align="right" />
      </div>
    </div>
  );
}
