"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/AppDataProvider";

export default function NewEntryRedirectPage() {
  const router = useRouter();
  const { createEntry, currentUser, isHydrated } = useAppData();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!currentUser) {
      router.replace("/register?next=/wc/entry/new");
      return;
    }

    const created = createEntry();
    if (created) {
      router.replace(`/entries/${created.id}`);
    }
  }, [createEntry, currentUser, isHydrated, router]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#153b63_0%,#0b2442_30%,#081829_62%,#050d16_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.94),rgba(14,47,77,0.92))] p-8 text-center shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
        <div className="text-sm uppercase tracking-[0.28em] text-cyan-100/64">Preparing Entry</div>
        <div className="mt-4 text-2xl font-semibold text-white">
          Creating your next bracket workspace...
        </div>
      </div>
    </main>
  );
}
