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
      <Link href="/" className="text-sm font-semibold uppercase tracking-[0.34em] rr-kicker">
        World Cup Bracket Challenge
      </Link>

      <div className="flex items-center gap-3">
        {showWorkspaceLink && currentUser ? (
          <Link
            href="/workspace"
            className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-medium"
          >
            Workspace
          </Link>
        ) : null}

        {showCreateButton ? (
          <button
            type="button"
            onClick={handleCreateEntry}
            className="rr-primary-btn rounded-full px-4 py-2 text-sm font-semibold"
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
            className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-medium"
          >
            Log out
          </button>
        ) : (
          <Link
            href="/register"
            className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-medium"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
