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

    void (async () => {
      const created = await createEntry();
      if (created) {
        router.replace(`/entries/${created.id}`);
      }
    })();
  }, [createEntry, currentUser, isHydrated, router]);

  return (
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="rr-frame mx-auto max-w-3xl rounded-[32px] p-8 text-center">
        <div className="rr-kicker text-sm uppercase tracking-[0.28em]">Preparing Entry</div>
        <div className="mt-4 text-2xl font-semibold text-[#251a18]">
          Creating your next bracket wizard...
        </div>
      </div>
    </main>
  );
}
