"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";
import type { StoredEntry } from "@/lib/types";

type WorkspaceTab = "entries" | "pools";

function getEntryScore(entry: StoredEntry) {
  return entry.result?.total_points ?? entry.score_total ?? null;
}

export default function WorkspacePage() {
  const router = useRouter();
  const {
    addEntryToPool,
    createEntry,
    createPool,
    currentUser,
    entries,
    isHydrated,
    isUserInPool,
    pools,
  } = useAppData();
  const [tab, setTab] = useState<WorkspaceTab>("entries");
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolDescription, setNewPoolDescription] = useState("");
  const [poolError, setPoolError] = useState<string | null>(null);

  const userEntries = useMemo(
    () => entries.filter((entry) => entry.owner_id === currentUser?.id),
    [currentUser?.id, entries]
  );
  const userPools = useMemo(
    () => pools.filter((pool) => isUserInPool(pool.id, currentUser?.id)),
    [currentUser?.id, isUserInPool, pools]
  );

  useEffect(() => {
    if (isHydrated && !currentUser) {
      router.replace("/register?next=/workspace");
    }
  }, [currentUser, isHydrated, router]);

  function handleCreateEntry() {
    const created = createEntry();
    if (created) {
      router.push(`/entries/${created.id}`);
    }
  }

  function handleCreatePool() {
    const outcome = createPool({
      name: newPoolName,
      description: newPoolDescription,
    });

    if (!outcome.ok) {
      setPoolError(outcome.message);
      return;
    }

    setPoolError(null);
    setNewPoolName("");
    setNewPoolDescription("");
    setTab("pools");
    router.push(`/pools/${outcome.pool.id}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#13385d_0%,#0b2442_34%,#06111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
          <AppHeader />

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/75">
                Workspace
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                {currentUser ? `${currentUser.name}'s control room` : "Your control room"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-cyan-100/72">
                Build entries, drop them into pools, and open any pool to see the live
                leaderboard and view submitted entries.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateEntry}
              disabled={!isHydrated}
              className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create New Entry
            </button>
          </div>

          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/6 p-1">
            {(["entries", "pools"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={[
                  "rounded-full px-5 py-2 text-sm font-semibold capitalize transition",
                  tab === value
                    ? "bg-[linear-gradient(135deg,#f7de88,#e4ad35)] text-slate-950"
                    : "text-white/74 hover:text-white",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        {tab === "entries" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {userEntries.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/6 p-6 text-cyan-100/72">
                No entries yet. Create one to start the group-to-knockout flow.
              </div>
            ) : null}

            {userEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/55">
                      {entry.status}
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{entry.entry_name}</h2>
                    <div className="mt-2 text-sm text-cyan-100/60">
                      Updated {new Date(entry.updated_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-300/24 bg-amber-300/10 px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Score</div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      {getEntryScore(entry) ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {entry.pool_ids.length > 0 ? (
                    entry.pool_ids.map((poolId) => {
                      const pool = pools.find((candidate) => candidate.id === poolId);
                      if (!pool) {
                        return null;
                      }

                      return (
                        <Link
                          key={poolId}
                          href={`/pools/${poolId}`}
                          className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50/80"
                        >
                          {pool.name}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="text-sm text-cyan-100/55">Not in any pools yet.</div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/entries/${entry.id}`}
                    className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                  >
                    Open Entry
                  </Link>

                  {userPools
                    .filter((pool) => !entry.pool_ids.includes(pool.id))
                    .map((pool) => (
                      <button
                        key={pool.id}
                        type="button"
                        onClick={() => addEntryToPool(entry.id, pool.id)}
                        className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        Add to {pool.name}
                      </button>
                    ))}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/75">
                  Create Pool
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  Start your own bracket competition
                </div>
                <div className="mt-3 text-sm leading-7 text-cyan-100/68">
                  Make a pool, share the invite link, and let other users join before adding
                  their entries.
                </div>

                <div className="mt-5 space-y-4">
                  <input
                    value={newPoolName}
                    onChange={(event) => setNewPoolName(event.target.value)}
                    placeholder="Office Pool"
                    className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-cyan-100/35 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  />
                  <textarea
                    value={newPoolDescription}
                    onChange={(event) => setNewPoolDescription(event.target.value)}
                    placeholder="A high-chaos pool for the office group chat."
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-cyan-100/35 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  />

                  {poolError ? (
                    <div className="rounded-2xl border border-red-400/28 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {poolError}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCreatePool}
                    className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                  >
                    Create Pool
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                  Your pool workflow
                </div>
                <div className="mt-5 space-y-4 text-sm leading-7 text-cyan-100/72">
                  <p>1. Create a pool and copy the invite link.</p>
                  <p>2. Have another user open that share link and join the pool.</p>
                  <p>3. Add your own entries into the pool once you&apos;re a member.</p>
                  <p>4. Open the pool page to compare leaderboard standings and inspect every entry.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
            {userPools.map((pool) => {
              const poolEntries = entries.filter((entry) => entry.pool_ids.includes(pool.id));
              const leader = [...poolEntries].sort(
                (left, right) => (getEntryScore(right) ?? 0) - (getEntryScore(left) ?? 0)
              )[0];

              return (
                <Link
                  key={pool.id}
                  href={`/pools/${pool.id}`}
                  className={`rounded-[28px] border border-white/10 bg-[linear-gradient(155deg,rgba(8,26,43,0.96),rgba(17,59,82,0.88))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)] transition hover:-translate-y-0.5`}
                >
                  <div className={`rounded-2xl bg-linear-to-r ${pool.accent} px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/82`}>
                    {pool.name}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-cyan-100/70">{pool.description}</p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Entries</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{poolEntries.length}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Leader</div>
                      <div className="mt-2 text-xl font-semibold text-white">
                        {leader ? leader.entry_name : "Open pool"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {userPools.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/6 p-6 text-cyan-100/72">
                You haven&apos;t joined any pools yet. Create one above or use an invite link.
              </div>
            ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
