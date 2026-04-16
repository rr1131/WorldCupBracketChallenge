import TeamBadge from "@/components/entry/TeamBadge";
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
    <div className="rounded-[24px] border border-[#193a4f]/12 bg-[linear-gradient(160deg,rgba(11,34,52,0.96),rgba(18,58,79,0.92))] p-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
        Predicted standings
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/6">
        <table className="w-full text-xs">
          <thead className="text-cyan-100/60">
            <tr className="border-b border-white/10">
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
              <tr key={team.team} className="border-b border-white/6 text-cyan-50/90 last:border-b-0">
                <td className="px-2 py-2 font-semibold">{index + 1}</td>
                <td className="px-2 py-2">
                  <TeamBadge teamCode={team.team} compact tone="dark" />
                </td>
                <td className="px-2 py-2 text-right font-semibold">{team.points}</td>
                <td className="px-2 py-2 text-right">{team.goalDifference}</td>
                <td className="px-2 py-2 text-right">{team.goalsFor}</td>
                <td className="px-2 py-2 text-right">{team.goalsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-cyan-100/55">
        Preview uses points, goal difference, goals scored, then alphabetical
        fallback.
      </p>
    </div>
  );
}
