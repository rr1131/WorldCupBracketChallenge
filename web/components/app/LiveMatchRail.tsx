"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TeamBadge from "@/components/entry/TeamBadge";
import { buildApiUrl } from "@/lib/api";
import type { LiveFixture, LiveScoreboard } from "@/lib/types";

const ESPN_SCOREBOARD_URL = "https://global.espn.com/football/scoreboard/_/league/fifa.world";
const REFRESH_INTERVAL_MS = 60_000;

function formatKickoffLabel(kickoffAt: string | null | undefined) {
  if (!kickoffAt) {
    return "Kickoff pending";
  }

  return new Date(kickoffAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStageLabel(fixture: LiveFixture) {
  if (fixture.kind === "group" && fixture.group_id) {
    return `Group ${fixture.group_id}`;
  }

  if (fixture.round_name) {
    return fixture.round_name.replace("_", " ");
  }

  return fixture.kind;
}

function getScoreline(fixture: LiveFixture) {
  if (fixture.status !== "in_progress" && fixture.status !== "final") {
    return null;
  }

  if (fixture.home_score === null || fixture.home_score === undefined) {
    return null;
  }

  if (fixture.away_score === null || fixture.away_score === undefined) {
    return null;
  }

  return `${fixture.home_score} - ${fixture.away_score}`;
}

function shouldShowStatusBadge(fixture: LiveFixture) {
  return fixture.status !== "scheduled";
}

function hasOdds(fixture: LiveFixture) {
  return Boolean(fixture.spread_line || fixture.over_under_line);
}

function sortFixturesByKickoffProximity(fixtures: LiveFixture[]) {
  const now = Date.now();

  return [...fixtures].sort((left, right) => {
    const leftKickoff = left.kickoff_at ? new Date(left.kickoff_at).getTime() : Number.POSITIVE_INFINITY;
    const rightKickoff = right.kickoff_at ? new Date(right.kickoff_at).getTime() : Number.POSITIVE_INFINITY;

    const leftDistance = Math.abs(leftKickoff - now);
    const rightDistance = Math.abs(rightKickoff - now);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return leftKickoff - rightKickoff;
  });
}

export default function LiveMatchRail() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scoreboard, setScoreboard] = useState<LiveScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadScoreboard() {
      try {
        const response = await fetch(buildApiUrl("/api/live/scoreboard"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Live scoreboard is unavailable right now.");
        }

        const payload = (await response.json()) as LiveScoreboard;
        if (!isMounted) {
          return;
        }

        setScoreboard(payload);
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Live scoreboard is unavailable right now.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadScoreboard();
    const intervalId = window.setInterval(loadScoreboard, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const fixtures = useMemo(
    () => sortFixturesByKickoffProximity(scoreboard?.fixtures ?? []).slice(0, 18),
    [scoreboard?.fixtures]
  );

  function scrollRail(direction: "prev" | "next") {
    const rail = scrollerRef.current;
    if (!rail) {
      return;
    }

    const amount = Math.max(rail.clientWidth * 0.88, 280);
    rail.scrollBy({
      left: direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  }

  return (
    <div className="rr-card-soft rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
          Match Center
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scoreboard?.stale ? (
            <div className="rr-inline-note rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
              Stale feed
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => scrollRail("prev")}
            className="rr-secondary-btn rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => scrollRail("next")}
            className="rr-secondary-btn rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            Next
          </button>
        </div>
      </div>

      {error ? (
        <div className="rr-inline-note mt-5 rounded-2xl px-4 py-4 text-sm">
          {error}{" "}
          <a
            href={ESPN_SCOREBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="rr-link font-semibold"
          >
            Open ESPN&apos;s World Cup scoreboard instead.
          </a>
        </div>
      ) : null}

      {!error ? (
        <div
          ref={scrollerRef}
          className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        >
          {fixtures.map((fixture) => {
            const scoreline = getScoreline(fixture);

            return (
              <article
                key={fixture.fixture_id}
                className="rr-card min-w-[260px] snap-start rounded-[24px] p-4 sm:min-w-[290px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="rr-soft text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {fixture.fixture_id}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#251a18]">
                      {formatStageLabel(fixture)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {hasOdds(fixture) ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {fixture.spread_line ? (
                          <div className="rounded-full border border-[rgba(146,86,76,0.12)] bg-[#fff8f7] px-3 py-1 text-[11px] font-semibold text-[#6b5752]">
                            <span className="rr-soft mr-1 uppercase tracking-[0.16em]">Spread</span>
                            <span className="text-[#251a18]">{fixture.spread_line}</span>
                          </div>
                        ) : null}
                        {fixture.over_under_line ? (
                          <div className="rounded-full border border-[rgba(146,86,76,0.12)] bg-[#fff8f7] px-3 py-1 text-[11px] font-semibold text-[#6b5752]">
                            <span className="rr-soft mr-1 uppercase tracking-[0.16em]">O/U</span>
                            <span className="text-[#251a18]">{fixture.over_under_line}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {shouldShowStatusBadge(fixture) ? (
                      <div
                        className={[
                          "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                          fixture.status === "final"
                            ? "bg-[#fdeef0] text-[#8e1f29]"
                            : fixture.status === "in_progress"
                              ? "bg-[#fff4e4] text-[#9a4b0f]"
                              : "bg-[#f7f1ee] text-[#6b5752]",
                        ].join(" ")}
                      >
                        {fixture.display_status}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {[fixture.home_team, fixture.away_team].map((team, index) => {
                    const isWinner =
                      fixture.status === "final" &&
                      fixture.winner_team !== null &&
                      fixture.winner_team !== undefined &&
                      fixture.winner_team === team;

                    return (
                      <div
                        key={`${fixture.fixture_id}-${team ?? index}`}
                        className={[
                          "rounded-2xl border px-3 py-3 transition",
                          isWinner
                            ? "border-[#72bf78] bg-[linear-gradient(135deg,#edf8ee,#d8f0db)] shadow-[0_10px_28px_rgba(58,140,74,0.16)]"
                            : "border-[rgba(146,86,76,0.14)] bg-white",
                        ].join(" ")}
                      >
                        {team ? (
                          <TeamBadge teamCode={team} tone="dark" compact />
                        ) : (
                          <div className="rr-body text-sm">TBD</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="rr-soft text-[11px] font-semibold uppercase tracking-[0.18em]">
                      Kickoff
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#251a18]">
                      {formatKickoffLabel(fixture.kickoff_at)}
                    </div>
                  </div>
                  <div className="rr-score-card rounded-2xl px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em]">Score</div>
                    <div className="mt-1 text-xl font-semibold text-[#8e1f29]">
                      {scoreline ?? "—"}
                    </div>
                  </div>
                </div>

              </article>
            );
          })}

          {!loading && fixtures.length === 0 ? (
            <div className="rr-inline-note min-w-full rounded-2xl px-4 py-5 text-sm">
              The live feed is on, but no mapped World Cup fixtures are available yet.
            </div>
          ) : null}

          {loading ? (
            <div className="rr-inline-note min-w-full rounded-2xl px-4 py-5 text-sm">
              Loading the latest World Cup scoreboard...
            </div>
          ) : null}
        </div>
      ) : null}

      {!error && scoreboard?.synced_at ? (
        <div className="rr-body mt-4 text-xs">
          Last synced {new Date(scoreboard.synced_at).toLocaleString()} via {scoreboard.provider}.
        </div>
      ) : null}
    </div>
  );
}
