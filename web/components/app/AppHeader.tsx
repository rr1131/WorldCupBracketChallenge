"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/AppDataProvider";

type AppHeaderProps = {
  showWorkspaceLink?: boolean;
  showCreateButton?: boolean;
  showAuthLink?: boolean;
};

export default function AppHeader({
  showWorkspaceLink = true,
  showCreateButton = true,
  showAuthLink = true,
}: AppHeaderProps) {
  const router = useRouter();
  const { currentUser, createEntry, logoutUser } = useAppData();

  async function handleCreateEntry() {
    if (!currentUser) {
      router.push("/register?next=/wc/entry/new");
      return;
    }

    const created = await createEntry();
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
            My Wizard
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
                void logoutUser().then(() => {
                  router.push("/");
                });
              }}
              className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-medium"
            >
            Log out
          </button>
        ) : showAuthLink ? (
          <Link
            href="/register"
            className="rr-secondary-btn rounded-full px-4 py-2 text-sm font-medium"
          >
            Login
          </Link>
        ) : null}
      </div>
    </header>
  );
}
