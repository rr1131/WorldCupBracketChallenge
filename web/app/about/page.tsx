"use client";

import Link from "next/link";
import AppHeader from "@/components/app/AppHeader";

export default function AboutPage() {
  return (
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rr-frame rounded-[32px] p-6">
          <AppHeader />

          <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                About Scoring
              </div>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-[#251a18]">
                How entries are graded in the bracket challenge
              </h1>
              <p className="rr-body mt-3 max-w-3xl text-sm leading-7">
                Every entry earns points from two major buckets: the group stage and the knockout
                stage. Add those together and you get the full tournament score.
              </p>
            </div>

            <Link
              href="/workspace"
              className="rr-secondary-btn rounded-full px-5 py-3 text-sm font-semibold"
            >
              Back to My Wizard
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rr-card rounded-[28px] p-5">
            <div className="rr-soft text-xs uppercase tracking-[0.18em]">Group Stage MAX</div>
            <div className="mt-2 text-4xl font-semibold text-[#251a18]">372</div>
            <div className="rr-body mt-2 text-sm">
              Everything you can earn from group match picks and final group standings.
            </div>
          </div>

          <div className="rr-card rounded-[28px] p-5">
            <div className="rr-soft text-xs uppercase tracking-[0.18em]">Knockout Stage MAX</div>
            <div className="mt-2 text-4xl font-semibold text-[#251a18]">384</div>
            <div className="rr-body mt-2 text-sm">
              Everything available from round-by-round advancement and champion picks.
            </div>
          </div>

          <div className="rr-card-accent rounded-[28px] p-5 md:col-span-2 xl:col-span-1">
            <div className="rr-soft text-xs uppercase tracking-[0.18em]">Total MAX</div>
            <div className="mt-2 text-4xl font-semibold text-[#8e1f29]">756</div>
            <div className="rr-body mt-2 text-sm">
              A perfect bracket across both stages reaches the full tournament ceiling.
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rr-card rounded-[30px] p-6">
            <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
              Group Stage Scoring
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
              Group-stage points come from two places
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rr-card-soft rounded-2xl p-4">
                <div className="text-sm font-semibold text-[#251a18]">1. Match scores</div>
                <div className="rr-body mt-2 text-sm leading-7">
                  Exact scoreline = <span className="font-semibold text-[#8e1f29]">3 points</span>.
                  <br />
                  Correct outcome but wrong score ={" "}
                  <span className="font-semibold text-[#8e1f29]">1 point</span>.
                </div>
                <div className="text-sm font-semibold text-[#251a18]">Perfect Match Prediction = 3 PTS</div>
              </div>

              <div className="rr-card-soft rounded-2xl p-4">
                <div className="text-sm font-semibold text-[#251a18]">2. Group standings</div>
                <div className="rr-body mt-2 text-sm leading-7">
                  Correct exact placement for a team ={" "}
                  <span className="font-semibold text-[#8e1f29]">2 points</span>.
                  <br />
                  Correct top two teams in the group ={" "}
                  <span className="font-semibold text-[#8e1f29]">2 bonus points</span>.
                  <br />
                  Entire group in exact order ={" "}
                  <span className="font-semibold text-[#8e1f29]">3 bonus points</span>.
                </div>
                <div className="text-sm font-semibold text-[#251a18]">Perfect Group Standings = 13 PTS</div>

              </div>
            </div>
          </div>

          <div className="rr-card rounded-[30px] p-6">
            <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
              Knockout Stage Scoring
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">
              Knockout points reward teams you place into the right rounds
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rr-card-soft rounded-2xl p-4">
                <div className="rr-body text-sm leading-7">
                  Correctly placing a team into the{" "}
                  <span className="font-semibold text-[#8e1f29]">Round of 32 = 2 points</span>.
                  <br />
                  <span className="font-semibold text-[#8e1f29]">Round of 16 = 4 points</span>.
                  <br />
                  <span className="font-semibold text-[#8e1f29]">Quarterfinals = 8 points</span>.
                  <br />
                  <span className="font-semibold text-[#8e1f29]">Semifinals = 16 points</span>.
                  <br />
                  <span className="font-semibold text-[#8e1f29]">Final = 32 points</span>.
                </div>
              </div>

              <div className="rr-card-soft rounded-2xl p-4">
                <div className="text-sm font-semibold text-[#251a18]">Champion bonus</div>
                <div className="rr-body mt-2 text-sm leading-7">
                  Pick the tournament winner correctly and you earn an extra{" "}
                  <span className="font-semibold text-[#8e1f29]">64 points</span>.
                </div>
              </div>

              <div className="rr-inline-note rounded-2xl px-4 py-4 text-sm">
                Knockout scoring is team-based, so you are rewarded for getting teams into the
                correct stages of the bracket.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
