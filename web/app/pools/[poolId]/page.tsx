"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";
import type { StoredEntry } from "@/lib/types";

function getScore(entry: StoredEntry) {
  return entry.result?.total_points ?? entry.score_total ?? null;
}

export default function PoolDetailPage() {
  const router = useRouter();
  const params = useParams<{ poolId: string }>();
  const {
    addEntryToPool,
    currentUser,
    entries,
    getPoolById,
    isHydrated,
    isUserInPool,
    joinPoolByInviteCode,
  } = useAppData();
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const pool = getPoolById(params.poolId);
  const isMember = isUserInPool(params.poolId, currentUser?.id);

  const leaderboard = useMemo(() => {
    return entries
      .filter((entry) => entry.pool_ids.includes(params.poolId))
      .sort((left, right) => (getScore(right) ?? 0) - (getScore(left) ?? 0));
  }, [entries, params.poolId]);

  const addableEntries = useMemo(() => {
    return entries.filter(
      (entry) =>
        entry.owner_id === currentUser?.id &&
        !entry.pool_ids.includes(params.poolId)
    );
  }, [currentUser?.id, entries, params.poolId]);

  const shareLink = useMemo(() => {
    if (!pool) {
      return "";
    }

    if (typeof window === "undefined") {
      return `/pools/join/${pool.invite_code}`;
    }

    return `${window.location.origin}/pools/join/${pool.invite_code}`;
  }, [pool]);

  useEffect(() => {
    if (isHydrated && !currentUser) {
      router.replace(`/register?next=/pools/${params.poolId}`);
    }
  }, [currentUser, isHydrated, params.poolId, router]);

  if (isHydrated && !pool) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#13385d_0%,#0b2442_34%,#06111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
            <AppHeader />
            <div className="mt-10 text-lg text-cyan-100/72">That pool was not found.</div>
          </section>
        </div>
      </main>
    );
  }

  if (!pool) {
    return null;
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareMessage("Invite link copied.");
    } catch {
      setShareMessage("Could not copy automatically. You can still copy the link below.");
    }
  }

  function handleJoinPool() {
    const outcome = joinPoolByInviteCode(pool.invite_code);
    setShareMessage(outcome.ok ? "You joined this pool." : outcome.message);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#13385d_0%,#0b2442_34%,#06111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
          <AppHeader />

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/75">
                Pool
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-white">{pool.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-cyan-100/72">
                {pool.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-cyan-100/65">
                <div>Owner: {pool.owner_name}</div>
                <div>•</div>
                <div>{pool.member_ids.length} members</div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Invite link</div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-[#091e30] px-4 py-3 text-sm text-cyan-50/75">
                  {shareLink}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                  >
                    Copy Share Link
                  </button>
                  {!isMember ? (
                    <button
                      type="button"
                      onClick={handleJoinPool}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
                    >
                      Join Pool
                    </button>
                  ) : null}
                </div>
                {shareMessage ? (
                  <div className="mt-3 text-sm text-cyan-100/72">{shareMessage}</div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Invite code</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{pool.invite_code}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Entries</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{leaderboard.length}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isMember ? (
          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                  Add Your Entries
                </div>
                <div className="mt-2 text-xl font-semibold text-white">
                  Enter your brackets into this pool
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {addableEntries.length > 0 ? (
                addableEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => addEntryToPool(entry.id, pool.id)}
                    className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    Add {entry.entry_name}
                  </button>
                ))
              ) : (
                <div className="text-sm text-cyan-100/65">
                  All of your entries are already in this pool, or you haven&apos;t created one yet.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
              Leaderboard
            </div>
            <div className="mt-5 space-y-3">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-4"
                >
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/50">
                      #{index + 1}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{entry.entry_name}</div>
                    <div className="text-sm text-cyan-100/60">{entry.owner_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/50">Points</div>
                    <div className="mt-1 text-2xl font-semibold text-white">{getScore(entry) ?? "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,26,43,0.96),rgba(17,59,82,0.9))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                Entries
              </div>
              <Link
                href="/workspace"
                className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                Back to workspace
              </Link>
            </div>

            <div className="mt-5 grid gap-4">
              {leaderboard.map((entry) => {
                const isOwner = currentUser?.id === entry.owner_id;

                return (
                  <div
                    key={entry.id}
                    className="rounded-[24px] border border-white/10 bg-white/6 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
                          {isOwner ? "Your entry" : "View only"}
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{entry.entry_name}</h2>
                        <div className="mt-2 text-sm text-cyan-100/60">By {entry.owner_name}</div>
                      </div>

                      <div className="rounded-2xl border border-amber-300/24 bg-amber-300/10 px-4 py-3 text-right">
                        <div className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Score</div>
                        <div className="mt-1 text-2xl font-semibold text-white">
                          {getScore(entry) ?? "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                      >
                        {isOwner ? "Open and Edit" : "View Entry"}
                      </Link>
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-6 text-sm text-cyan-100/65">
                  No entries have been added to this pool yet.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
