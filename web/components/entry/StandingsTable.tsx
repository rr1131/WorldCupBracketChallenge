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
    <div className="rr-card rounded-[24px] p-4 text-[#251a18]">
      <div className="rr-kicker mb-3 text-xs font-semibold uppercase tracking-[0.22em]">
        Predicted standings
      </div>

      <div className="overflow-hidden rounded-2xl border border-[rgba(146,86,76,0.14)] bg-[#fff8f7]">
        <table className="w-full text-xs">
          <thead className="text-[#8c7770]">
            <tr className="border-b border-[rgba(146,86,76,0.12)]">
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
              <tr key={team.team} className="border-b border-[rgba(146,86,76,0.08)] text-[#251a18] last:border-b-0">
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

      <p className="rr-soft mt-3 text-[11px]">
        Preview uses points, goal difference, goals scored, then alphabetical
        fallback.
      </p>
    </div>
  );
}
