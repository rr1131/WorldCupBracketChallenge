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
  const { canEditEntry, currentUser, deleteEntry, getEntryById, isHydrated, updateEntry } = useAppData();
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
  const handleDelete = useCallback(() => {
    if (!entry) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this entry from your workspace? This also removes it from any pools it was in."
    );
    if (!confirmed) {
      return;
    }

    const outcome = deleteEntry(entry.id);
    if (!outcome.ok) {
      window.alert(outcome.message);
      return;
    }

    router.replace("/workspace");
  }, [deleteEntry, entry, router]);

  useEffect(() => {
    if (isHydrated && !currentUser) {
      router.replace(`/register?next=/entries/${params.entryId}`);
    }
  }, [currentUser, isHydrated, params.entryId, router]);

  if (isHydrated && !entry) {
    return (
      <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rr-frame rounded-[32px] p-6">
            <AppHeader />
            <div className="rr-body mt-10 text-lg">That entry was not found.</div>
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
      onDelete={handleDelete}
      onSave={handleSave}
    />
  );
}
