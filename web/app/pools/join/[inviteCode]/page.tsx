"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";

export default function JoinPoolPage() {
  const router = useRouter();
  const params = useParams<{ inviteCode: string }>();
  const {
    currentUser,
    getPoolByInviteCode,
    isHydrated,
    isUserInPool,
    joinPoolByInviteCode,
  } = useAppData();
  const [password, setPassword] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const pool = useMemo(
    () => getPoolByInviteCode(params.inviteCode),
    [getPoolByInviteCode, params.inviteCode]
  );
  const isMember = isUserInPool(pool?.id ?? "", currentUser?.id);

  useEffect(() => {
    if (isHydrated && !currentUser) {
      router.replace(`/register?next=/pools/join/${params.inviteCode}`);
    }
  }, [currentUser, isHydrated, params.inviteCode, router]);

  function handleJoinPool() {
    const outcome = joinPoolByInviteCode(params.inviteCode, password);
    if (!outcome.ok) {
      setJoinError(outcome.message);
      return;
    }

    setJoinError(null);
    router.replace(`/pools/${outcome.pool.id}`);
  }

  if (isHydrated && !pool) {
    return (
      <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rr-frame rounded-[32px] p-6">
            <AppHeader />
            <div className="rr-card-soft mt-10 rounded-[28px] p-8 text-center">
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                Join Pool
              </div>
              <div className="mt-4 text-2xl font-semibold text-[#251a18]">
                That invite link does not match a pool.
              </div>
              <div className="mt-6">
                <Link
                  href="/workspace"
                  className="rr-primary-btn rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Back to My Wizard
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!pool) {
    return null;
  }

  return (
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rr-frame rounded-[32px] p-6">
          <AppHeader />

          <div className="rr-card-soft mt-10 rounded-[28px] p-8">
            <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.28em]">
              Join Pool
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-[#251a18]">{pool.name}</h1>
            <p className="rr-body mt-3 text-base leading-7">{pool.description}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rr-card rounded-2xl p-4">
                <div className="rr-soft text-xs uppercase tracking-[0.18em]">Invite code</div>
                <div className="mt-2 text-xl font-semibold text-[#251a18]">{pool.invite_code}</div>
              </div>
              <div className="rr-card rounded-2xl p-4">
                <div className="rr-soft text-xs uppercase tracking-[0.18em]">Owner</div>
                <div className="mt-2 text-xl font-semibold text-[#251a18]">{pool.owner_name}</div>
              </div>
              <div className="rr-card rounded-2xl p-4">
                <div className="rr-soft text-xs uppercase tracking-[0.18em]">Access</div>
                <div className="mt-2 text-xl font-semibold text-[#251a18]">
                  {pool.join_password ? "Password protected" : "Invite link"}
                </div>
              </div>
            </div>

            {isMember ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rr-inline-note rounded-2xl px-4 py-3 text-sm">
                  You&apos;re already a member of this pool.
                </div>
                <Link
                  href={`/pools/${pool.id}`}
                  className="rr-primary-btn rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Open Pool
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {pool.join_password ? (
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Shared pool password"
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                  />
                ) : null}

                {joinError ? (
                  <div className="rr-error rounded-2xl px-4 py-3 text-sm">{joinError}</div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleJoinPool}
                    className="rr-primary-btn rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Join Pool
                  </button>
                  <Link
                    href="/workspace"
                    className="rr-secondary-btn rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Back to My Wizard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
