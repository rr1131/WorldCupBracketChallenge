"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";

export default function JoinPoolPage() {
  const router = useRouter();
  const params = useParams<{ inviteCode: string }>();
  const { currentUser, isHydrated, joinPoolByInviteCode } = useAppData();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!currentUser) {
      router.replace(`/register?next=/pools/join/${params.inviteCode}`);
      return;
    }

    const outcome = joinPoolByInviteCode(params.inviteCode);
    if (!outcome.ok) {
      router.replace("/workspace");
      return;
    }

    router.replace(`/pools/${outcome.pool.id}`);
  }, [currentUser, isHydrated, joinPoolByInviteCode, params.inviteCode, router]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#13385d_0%,#0b2442_34%,#06111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
          <AppHeader />
          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/6 p-8 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/75">
              Join Pool
            </div>
            <div className="mt-4 text-2xl font-semibold text-white">
              Validating invite link...
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
