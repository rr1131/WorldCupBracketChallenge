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
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rr-frame rounded-[34px] p-6 md:p-8">
          <AppHeader showWorkspaceLink={Boolean(currentUser)} showCreateButton={false} />

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="rr-badge inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em]">
                2026 Tournament Builder
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-[#251a18] md:text-6xl">
                World Cup Bracket Challenge
              </h1>
              <p className="rr-body mt-6 max-w-2xl text-lg leading-8">
                Build every group, generate the official knockout bracket, and score complete
                entries against the tournament truth data. Then drop your entries into pools
                and track the leaderboard with everyone else.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleCreateEntry}
                  disabled={!isHydrated}
                  className="rr-primary-btn rounded-full px-7 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create Entry
                </button>

                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => router.push("/workspace")}
                    className="rr-secondary-btn rounded-full px-7 py-3 text-base font-semibold"
                  >
                    Open Workspace
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="rr-secondary-btn rounded-full px-7 py-3 text-base font-semibold"
                  >
                    Register or Login
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rr-card rounded-[28px] p-6">
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.26em]">
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
                      className="rr-card-soft rounded-2xl px-4 py-4 text-sm leading-6 rr-body"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rr-card-accent rounded-[28px] p-6">
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.26em]">
                  Signed-In Workspace
                </div>
                <div className="rr-body mt-4 text-sm leading-7">
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
