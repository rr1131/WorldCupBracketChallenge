"use client";

import { useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import EntryBuilder from "@/components/entry/EntryBuilder";
import EntryViewer from "@/components/entry/EntryViewer";
import { useAppData } from "@/components/providers/AppDataProvider";
import type { StoredEntry } from "@/lib/types";

export default function EntryDetailPage() {
  const router = useRouter();
  const params = useParams<{ entryId: string }>();
  const { canEditEntry, currentUser, getEntryById, isHydrated, updateEntry } = useAppData();
  const entry = getEntryById(params.entryId);
  const isEditable = canEditEntry(entry);
  const handleSave = useCallback(
    (updates: Partial<StoredEntry>) => {
      if (!entry) {
        return;
      }

      updateEntry(entry.id, updates);
    },
    [entry, updateEntry]
  );

  useEffect(() => {
    if (isHydrated && !currentUser) {
      router.replace(`/register?next=/entries/${params.entryId}`);
    }
  }, [currentUser, isHydrated, params.entryId, router]);

  if (isHydrated && !entry) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#13385d_0%,#0b2442_34%,#06111d_70%,#040910_100%)] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)]">
            <AppHeader />
            <div className="mt-10 text-lg text-cyan-100/72">That entry was not found.</div>
          </section>
        </div>
      </main>
    );
  }

  if (!entry) {
    return null;
  }

  if (!isEditable) {
    return <EntryViewer entry={entry} />;
  }

  return (
    <EntryBuilder
      entry={entry}
      onSave={handleSave}
    />
  );
}
