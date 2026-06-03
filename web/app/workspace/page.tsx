"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import LiveMatchRail from "@/components/app/LiveMatchRail";
import { useAppData } from "@/components/providers/AppDataProvider";
import FlagIcon from "@/components/entry/FlagIcon";
import { getEntryChampionTeam, isEntryComplete } from "@/lib/entries";
import type { StoredEntry } from "@/lib/types";

type WorkspaceTab = "entries" | "pools";

function getEntryScore(entry: StoredEntry) {
  return entry.result?.total_points ?? entry.score_total ?? null;
}

function getEntryMax(entry: StoredEntry) {
  return entry.max_possible_points ?? null;
}

export default function WorkspacePage() {
  const router = useRouter();
  const {
    addEntryToPool,
    createEntry,
    createPool,
    currentUser,
    deleteEntry,
    entries,
    isHydrated,
    isUserInPool,
    pools,
  } = useAppData();
  const [tab, setTab] = useState<WorkspaceTab>("entries");
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolDescription, setNewPoolDescription] = useState("");
  const [newPoolPassword, setNewPoolPassword] = useState("");
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

  async function handleCreateEntry() {
    const created = await createEntry();
    if (created) {
      router.push(`/entries/${created.id}`);
    }
  }

  async function handleCreatePool() {
    const outcome = await createPool({
      name: newPoolName,
      description: newPoolDescription,
      joinPassword: newPoolPassword,
    });

    if (!outcome.ok) {
      setPoolError(outcome.message);
      return;
    }

    setPoolError(null);
    setNewPoolName("");
    setNewPoolDescription("");
    setNewPoolPassword("");
    setTab("pools");
    router.push(`/pools/${outcome.pool.id}`);
  }

  async function handleDeleteEntry(entryId: string) {
    const confirmed = window.confirm(
      "Delete this entry from your wizard? This also removes it from any pools it was in."
    );

    if (!confirmed) {
      return;
    }

    const outcome = await deleteEntry(entryId);
    if (!outcome.ok) {
      window.alert(outcome.message);
    }
  }

  return (
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rr-frame rounded-[32px] p-6">
          <AppHeader showWorkspaceLink={false} showCreateButton={false} />
          <div className="mt-6">
            <LiveMatchRail />
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                My Wizard
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#251a18]">
                {currentUser ? `${currentUser.name}'s control room` : "Your control room"}
              </h1>
              <p className="rr-body mt-3 max-w-3xl text-sm leading-7">
                Build entries, drop them into pools, and open any pool to see the live
                leaderboard and view submitted entries.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateEntry}
              disabled={!isHydrated}
              className="rr-primary-btn rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create New Entry
            </button>
            <Link
              href="/about"
              className="rr-secondary-btn rounded-full px-5 py-3 text-sm font-semibold"
            >
              About Scoring
            </Link>
          </div>

          <div className="rr-tab-strip mt-8 inline-flex rounded-full p-1">
            {(["entries", "pools"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={[
                  "rounded-full px-5 py-2 text-sm font-semibold capitalize transition",
                  tab === value
                    ? "rr-tab-active"
                    : "rr-tab-idle",
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
              <div className="rr-card-soft rounded-[28px] p-6 rr-body">
                No entries yet. Create one to start the group-to-knockout flow.
              </div>
            ) : null}

            {userEntries.map((entry) => (
              ((isComplete, championTeam) => (
              <article
                key={entry.id}
                className={[
                  "rounded-[28px] p-6",
                  isComplete
                    ? "border border-[#8fd19a] bg-[linear-gradient(180deg,rgba(246,255,247,0.98),rgba(235,248,236,0.94))] shadow-[0_24px_70px_rgba(58,140,74,0.12)]"
                    : "rr-card",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      className={[
                        "text-xs font-semibold uppercase tracking-[0.2em]",
                        isComplete ? "text-[#2f7a3e]" : "rr-kicker",
                      ].join(" ")}
                    >
                      {isComplete ? "Completed" : entry.status}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold text-[#251a18]">{entry.entry_name}</h2>
                      {isComplete && championTeam ? (
                        <FlagIcon teamCode={championTeam} className="h-6 w-8 rounded-md" />
                      ) : null}
                    </div>
                    <div className="rr-body mt-2 text-sm">
                      Updated {new Date(entry.updated_at).toLocaleString()}
                    </div>
                    {!isComplete ? (
                      <div className="mt-2 text-sm font-medium text-[#8c7770]">
                        Not complete yet.
                      </div>
                    ) : null}
                  </div>

                  <div className="rr-score-card rounded-2xl px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-[0.18em]">PTS / MAX</div>
                    <div className="mt-1 text-2xl font-semibold text-[#8e1f29]">
                      {getEntryScore(entry) ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-[#8e1f29]/70">
                      {getEntryMax(entry) ?? "—"}
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
                          className="rr-secondary-btn rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]"
                        >
                          {pool.name}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="rr-body text-sm">Not in any pools yet.</div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/entries/${entry.id}`}
                    className="rr-primary-btn rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    Open Entry
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDeleteEntry(entry.id)}
                    className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    Delete Entry
                  </button>

                  {userPools
                    .filter((pool) => !entry.pool_ids.includes(pool.id))
                    .map((pool) => (
                      <button
                        key={pool.id}
                        type="button"
                        onClick={() => void addEntryToPool(entry.id, pool.id)}
                        className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        Add to {pool.name}
                      </button>
                    ))}
                </div>
              </article>
              ))(isEntryComplete(entry), getEntryChampionTeam(entry))
            ))}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rr-card rounded-[28px] p-6">
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                  Create Pool
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#251a18]">
                  Start your own bracket competition
                </div>
                <div className="rr-body mt-3 text-sm leading-7">
                  Make a pool, share the invite link, and let other users join before adding
                  their entries.
                </div>

                <div className="mt-5 space-y-4">
                  <input
                    value={newPoolName}
                    onChange={(event) => setNewPoolName(event.target.value)}
                    placeholder="Pool Name"
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                  />
                  <textarea
                    value={newPoolDescription}
                    onChange={(event) => setNewPoolDescription(event.target.value)}
                    placeholder="Description"
                    rows={4}
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                  />
                  <input
                    value={newPoolPassword}
                    onChange={(event) => setNewPoolPassword(event.target.value)}
                    placeholder="Password (Optional)"
                    type="password"
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                  />

                  {poolError ? (
                    <div className="rr-error rounded-2xl px-4 py-3 text-sm">
                      {poolError}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCreatePool}
                    className="rr-primary-btn rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Create Pool
                  </button>
                </div>
              </div>

              <div className="rr-card-soft rounded-[28px] p-6">
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                  Your pool workflow
                </div>
                <div className="rr-body mt-5 space-y-4 text-sm leading-7">
                  <p>1. Create a pool and copy the invite link.</p>
                  <p>2. Optionally add a shared password so only intended members can join.</p>
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
                  className="rr-card rounded-[28px] p-6 transition hover:-translate-y-0.5"
                >
                  <div className={`rounded-2xl bg-linear-to-r ${pool.accent} px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#6e1a22]`}>
                    {pool.name}
                  </div>
                  <p className="rr-body mt-4 text-sm leading-7">{pool.description}</p>
                  <div className="rr-body mt-2 text-xs uppercase tracking-[0.16em]">
                    {pool.is_password_protected ? "Password protected" : "Invite link only"}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rr-card-soft rounded-2xl px-4 py-4">
                      <div className="rr-soft text-xs uppercase tracking-[0.18em]">Entries</div>
                      <div className="mt-2 text-3xl font-semibold text-[#251a18]">{poolEntries.length}</div>
                    </div>
                    <div className="rr-card-soft rounded-2xl px-4 py-4">
                      <div className="rr-soft text-xs uppercase tracking-[0.18em]">Leader</div>
                      <div className="mt-2 text-xl font-semibold text-[#251a18]">
                        {leader ? leader.entry_name : "Open pool"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {userPools.length === 0 ? (
              <div className="rr-card-soft rounded-[28px] p-6 rr-body">
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
