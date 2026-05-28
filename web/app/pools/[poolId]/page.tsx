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

function getMax(entry: StoredEntry) {
  return entry.max_possible_points ?? null;
}

export default function PoolDetailPage() {
  const router = useRouter();
  const params = useParams<{ poolId: string }>();
  const {
    addEntryToPool,
    currentUser,
    deletePool,
    entries,
    getPoolById,
    isHydrated,
    isUserInPool,
    joinPoolByInviteCode,
    removeEntryFromPool,
  } = useAppData();
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const pool = getPoolById(params.poolId);
  const isMember = isUserInPool(params.poolId, currentUser?.id);
  const isOwner = currentUser?.id === pool?.owner_id;

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
      <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rr-frame rounded-[32px] p-6">
            <AppHeader />
            <div className="rr-body mt-10 text-lg">That pool was not found.</div>
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
    const outcome = joinPoolByInviteCode(pool.invite_code, joinPassword);
    setShareMessage(outcome.ok ? "You joined this pool." : outcome.message);
  }

  function handleDeletePool() {
    const confirmed = window.confirm(
      "Delete this pool? All pool memberships and attached pool entries will be removed."
    );

    if (!confirmed) {
      return;
    }

    const outcome = deletePool(pool.id);
    if (!outcome.ok) {
      setShareMessage(outcome.message);
      return;
    }

    router.replace("/workspace");
  }

  return (
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rr-frame rounded-[32px] p-6">
          <AppHeader />

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                Pool
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-[#251a18]">{pool.name}</h1>
              <p className="rr-body mt-3 max-w-2xl text-base leading-7">
                {pool.description}
              </p>
              <div className="rr-body mt-4 flex flex-wrap gap-2 text-sm">
                <div>Owner: {pool.owner_name}</div>
                <div>•</div>
                <div>{pool.member_ids.length} members</div>
                <div>•</div>
                <div>{pool.join_password ? "Password protected" : "Open with invite link"}</div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rr-card-soft rounded-2xl p-4">
                <div className="rr-soft text-xs uppercase tracking-[0.18em]">Invite link</div>
                <div className="rr-inline-note mt-3 rounded-2xl px-4 py-3 text-sm">
                  {shareLink}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="rr-primary-btn rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    Copy Share Link
                  </button>
                  {!isMember ? (
                    <button
                      type="button"
                      onClick={handleJoinPool}
                      className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      Join Pool
                    </button>
                  ) : null}
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={handleDeletePool}
                      className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      Delete Pool
                    </button>
                  ) : null}
                </div>
                {!isMember && pool.join_password ? (
                  <div className="mt-3">
                    <input
                      value={joinPassword}
                      onChange={(event) => setJoinPassword(event.target.value)}
                      type="password"
                      placeholder="Shared pool password"
                      className="rr-input w-full rounded-2xl px-4 py-3 transition"
                    />
                  </div>
                ) : null}
                {shareMessage ? (
                  <div className="rr-body mt-3 text-sm">{shareMessage}</div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rr-card-soft rounded-2xl p-4">
                  <div className="rr-soft text-xs uppercase tracking-[0.18em]">Invite code</div>
                  <div className="mt-2 text-2xl font-semibold text-[#251a18]">{pool.invite_code}</div>
                </div>
                <div className="rr-card-soft rounded-2xl p-4">
                  <div className="rr-soft text-xs uppercase tracking-[0.18em]">Entries</div>
                  <div className="mt-2 text-2xl font-semibold text-[#251a18]">{leaderboard.length}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isMember ? (
          <section className="rr-card rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                  Add Your Entries
                </div>
                <div className="mt-2 text-xl font-semibold text-[#251a18]">
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
                    className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    Add {entry.entry_name}
                  </button>
                ))
              ) : (
                <div className="rr-body text-sm">
                  All of your entries are already in this pool, or you haven&apos;t created one yet.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="rr-card rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                Entries
              </div>
              <Link
                href="/workspace"
                className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
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
                    className="rr-card-soft rounded-[24px] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="rr-soft text-xs font-semibold uppercase tracking-[0.18em]">
                          {isOwner ? "Your entry" : "View only"}
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold text-[#251a18]">{entry.entry_name}</h2>
                        <div className="rr-body mt-2 text-sm">By {entry.owner_name}</div>
                      </div>

                      <div className="rr-score-card rounded-2xl px-4 py-3 text-right">
                        <div className="text-xs uppercase tracking-[0.18em]">PTS / MAX</div>
                        <div className="mt-1 text-xl font-semibold text-[#8e1f29]">
                          {getScore(entry) ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-[#8e1f29]/70">
                          {getMax(entry) ?? "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="rr-primary-btn rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        {isOwner ? "Open and Edit" : "View Entry"}
                      </Link>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => removeEntryFromPool(entry.id, pool.id)}
                          className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-semibold"
                        >
                          Remove from Pool
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 ? (
                <div className="rr-card-soft rounded-2xl px-4 py-6 text-sm rr-body">
                  No entries have been added to this pool yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rr-card rounded-[30px] p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.24em]">
                  Leaderboard
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#251a18]">
                  Live standings inside this pool
                </div>
              </div>
              <div className="rr-inline-note rounded-2xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em]">
                Rank / Pts / Max
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-[rgba(146,86,76,0.14)] bg-white">
              <div className="grid grid-cols-[88px_minmax(0,1fr)_88px_88px] gap-3 border-b border-[rgba(146,86,76,0.12)] bg-[#fff7f6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7770]">
                <div>Rank</div>
                <div>Entry</div>
                <div className="text-right">Pts</div>
                <div className="text-right">Max</div>
              </div>

              <div className="divide-y divide-[rgba(146,86,76,0.1)]">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[88px_minmax(0,1fr)_88px_88px] gap-3 px-4 py-4"
                  >
                    <div className="flex items-center">
                      <div className="rounded-full bg-[#fdeef0] px-3 py-1 text-sm font-semibold text-[#8e1f29]">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-[#251a18]">
                        {entry.entry_name}
                      </div>
                      <div className="rr-body truncate text-sm">{entry.owner_name}</div>
                    </div>
                    <div className="text-right text-lg font-semibold text-[#8e1f29]">
                      {getScore(entry) ?? "—"}
                    </div>
                    <div className="text-right text-lg font-semibold text-[#251a18]">
                      {getMax(entry) ?? "—"}
                    </div>
                  </div>
                ))}

                {leaderboard.length === 0 ? (
                  <div className="rr-body px-4 py-6 text-sm">
                    No entries have been added to this pool yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
