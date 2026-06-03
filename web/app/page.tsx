"use client";

import { useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";
import { withBasePath } from "@/lib/basePath";

export default function HomePage() {
  const router = useRouter();
  const { currentUser, createEntry, isHydrated } = useAppData();

  async function handleCreateEntry() {
    if (!currentUser) {
      router.push("/register?next=/wc/entry/new");
      return;
    }

    const created = await createEntry();
    if (created) {
      router.push(`/entries/${created.id}`);
    }
  }

  return (
    <main className="rr-page relative min-h-screen overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('${withBasePath("/64%20qatar.jpg")}')`,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,14,20,0.3)_0%,rgba(18,14,20,0.18)_24%,rgba(247,241,238,0.64)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rr-frame rounded-[34px] p-6 md:p-8">
          <AppHeader
            showWorkspaceLink={Boolean(currentUser)}
            showCreateButton={false}
            showAuthLink={false}
          />

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="rr-badge inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em]">
                2026 Tournament Builder
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-[#251a18] md:text-6xl">
                World Cup Bracket Challenge
              </h1>
              <p className="rr-body mt-6 max-w-2xl text-lg leading-8">
                Welcome to the RatRace WC Bracket Challenge! Build every group, generate the
                official knockout bracket, and let your entries score themselves as live World
                Cup results roll in. Then drop your brackets into pools and let the results speak for themselves! NOT AFFILIATED WITH FIFA or its trademarks!
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                {currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCreateEntry}
                      disabled={!isHydrated}
                      className="rr-primary-btn rounded-full px-7 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Create Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/workspace")}
                      className="rr-secondary-btn rounded-full px-7 py-3 text-base font-semibold"
                    >
                      Open My Wizard
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="rr-primary-btn rounded-full px-7 py-3 text-base font-semibold"
                  >
                    Register or Login
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rr-card rounded-[28px] p-6">
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.26em]">
                  How to Play
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    "Pick all 12 groups with compact score entry cards.",
                    "Generate the Round of 32 and click winners forward.",
                    "Pick YOUR champion!"
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
                  My Wizard
                </div>
                <div className="rr-body mt-4 text-sm leading-7">
                  Once you&apos;re signed in, your My Wizard area gives you two clean tabs:
                  entries for building and editing your own submissions, and pools for
                  seeing where you stack up on the leaderboard. 
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
