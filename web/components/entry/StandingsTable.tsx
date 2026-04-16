import { computeGroupStandings } from "@/lib/standings";
import type { MatchPrediction, TournamentConfig } from "@/lib/types";

type StandingsTableProps = {
  tournament: TournamentConfig;
  groupId: string;
  predictions: Record<string, MatchPrediction>;
};

export default function StandingsTable({
  tournament,
  groupId,
  predictions,
}: StandingsTableProps) {
  const standings = computeGroupStandings(tournament, groupId, predictions);

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-700">
        Predicted standings
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr className="border-b border-slate-200">
              <th className="px-2 py-2 text-left">Pos</th>
              <th className="px-2 py-2 text-left">Team</th>
              <th className="px-2 py-2 text-right">Pts</th>
              <th className="px-2 py-2 text-right">GD</th>
              <th className="px-2 py-2 text-right">GF</th>
              <th className="px-2 py-2 text-right">GA</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, index) => (
              <tr key={team.team} className="border-b border-slate-100 text-slate-700">
                <td className="px-2 py-2">{index + 1}</td>
                <td className="px-2 py-2 font-medium text-slate-950">{team.team}</td>
                <td className="px-2 py-2 text-right">{team.points}</td>
                <td className="px-2 py-2 text-right">{team.goalDifference}</td>
                <td className="px-2 py-2 text-right">{team.goalsFor}</td>
                <td className="px-2 py-2 text-right">{team.goalsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Preview uses points, goal difference, goals scored, then alphabetical
        fallback.
      </p>
    </div>
  );
}
