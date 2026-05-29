"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import EntryBuilder from "@/components/entry/EntryBuilder";
import EntryViewer from "@/components/entry/EntryViewer";
import { useAppData } from "@/components/providers/AppDataProvider";
import type { StoredEntry } from "@/lib/types";

export default function EntryDetailPage() {
  const router = useRouter();
  const params = useParams<{ entryId: string }>();
  const {
    canEditEntry,
    currentUser,
    deleteEntry,
    getEntryById,
    isHydrated,
    loadEntryById,
    updateEntry,
  } = useAppData();
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const entry = getEntryById(params.entryId);
  const isEditable = canEditEntry(entry);
  const handleSave = useCallback(
    (updates: Partial<StoredEntry>) => {
      if (!entry) {
        return;
      }

      void updateEntry(entry.id, updates);
    },
    [entry, updateEntry]
  );
  const handleDelete = useCallback(() => {
    if (!entry) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this entry from your wizard? This also removes it from any pools it was in."
    );
    if (!confirmed) {
      return;
    }

    void (async () => {
      const outcome = await deleteEntry(entry.id);
      if (!outcome.ok) {
        window.alert(outcome.message);
        return;
      }

      router.replace("/workspace");
    })();
  }, [deleteEntry, entry, router]);

  useEffect(() => {
    if (isHydrated && !currentUser) {
      router.replace(`/register?next=/entries/${params.entryId}`);
    }
  }, [currentUser, isHydrated, params.entryId, router]);

  useEffect(() => {
    if (!isHydrated || !currentUser) {
      return;
    }

    if (!entry) {
      void loadEntryById(params.entryId).finally(() => {
        setHasAttemptedLoad(true);
      });
    }
  }, [currentUser, entry, isHydrated, loadEntryById, params.entryId]);

  if (isHydrated && hasAttemptedLoad && !entry) {
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
