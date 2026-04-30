"use client";

import { useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";

export default function HomePage() {
  const router = useRouter();
  const { currentUser, createEntry, isHydrated } = useAppData();

  function handleCreateEntry() {
    if (!currentUser) {
      router.push("/register?next=/wc/entry/new");
      return;
    }

    const created = createEntry();
    if (created) {
      router.push(`/entries/${created.id}`);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#17426f_0%,#0b2442_35%,#07111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(140deg,rgba(8,26,43,0.96),rgba(12,44,76,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)] md:p-8">
          <AppHeader showWorkspaceLink={Boolean(currentUser)} showCreateButton={false} />

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/80">
                2026 Tournament Builder
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
                World Cup Bracket Challenge
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-100/72">
                Build every group, generate the official knockout bracket, and score complete
                entries against the tournament truth data. Then drop your entries into pools
                and track the leaderboard with everyone else.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleCreateEntry}
                  disabled={!isHydrated}
                  className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-7 py-3 text-base font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create Entry
                </button>

                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => router.push("/workspace")}
                    className="rounded-full border border-white/14 bg-white/6 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                  >
                    Open Workspace
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="rounded-full border border-white/14 bg-white/6 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                  >
                    Register or Login
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(165deg,rgba(6,32,53,0.98),rgba(9,56,79,0.86))] p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-100/60">
                  Builder Flow
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    "Pick all 12 groups with compact score entry cards.",
                    "Generate the Round of 32 and click winners forward.",
                    "Score the finished bracket and compare it inside pools.",
                  ].map((line) => (
                    <div
                      key={line}
                      className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-sm leading-6 text-cyan-50/82"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-amber-300/18 bg-[linear-gradient(165deg,rgba(247,222,136,0.14),rgba(228,173,53,0.06))] p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-200/72">
                  Signed-In Workspace
                </div>
                <div className="mt-4 text-sm leading-7 text-cyan-50/78">
                  Once you&apos;re signed in, your workspace gives you two clean tabs:
                  entries for building and editing your own submissions, and pools for
                  leaderboard-driven competition.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
