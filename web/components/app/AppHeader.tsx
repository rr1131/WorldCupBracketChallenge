"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/AppDataProvider";

type AppHeaderProps = {
  showWorkspaceLink?: boolean;
  showCreateButton?: boolean;
};

export default function AppHeader({
  showWorkspaceLink = true,
  showCreateButton = true,
}: AppHeaderProps) {
  const router = useRouter();
  const { currentUser, createEntry, logoutUser } = useAppData();

  function handleCreateEntry() {
    if (!currentUser) {
      router.push("/register?next=/wc/entry/new");
      return;
    }

    const created = createEntry();
    if (created) {
      router.push(`/entries/${created.id}`);
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="text-sm font-semibold uppercase tracking-[0.34em] text-cyan-100/75">
        World Cup Bracket Challenge
      </Link>

      <div className="flex items-center gap-3">
        {showWorkspaceLink && currentUser ? (
          <Link
            href="/workspace"
            className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Workspace
          </Link>
        ) : null}

        {showCreateButton ? (
          <button
            type="button"
            onClick={handleCreateEntry}
            className="rounded-full bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            Create Entry
          </button>
        ) : null}

        {currentUser ? (
          <button
            type="button"
            onClick={() => {
              logoutUser();
              router.push("/");
            }}
            className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Log out
          </button>
        ) : (
          <Link
            href="/register"
            className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
