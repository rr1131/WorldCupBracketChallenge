"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";

type Mode = "register" | "login";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isHydrated, loginUser, registerUser } = useAppData();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextHref = useMemo(() => searchParams.get("next") || "/workspace", [searchParams]);

  useEffect(() => {
    if (isHydrated && currentUser) {
      router.replace(nextHref);
    }
  }, [currentUser, isHydrated, nextHref, router]);

  async function submit() {
    const outcome =
      mode === "register"
        ? await registerUser({ name, email, password })
        : await loginUser({ email, password });

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }

    router.push(nextHref);
  }

  return (
    <main className="rr-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rr-frame rounded-[32px] p-6 md:p-8">
          <AppHeader showWorkspaceLink={false} />

          <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <div className="rr-kicker text-xs font-semibold uppercase tracking-[0.3em]">
                Access
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#251a18]">
                Register or log in to manage entries and pools.
              </h1>
              <p className="rr-body mt-4 max-w-xl text-base leading-7">
                Your account, entries, and pool memberships are stored on the live backend so
                you can pick up the same bracket from any device.
              </p>
            </div>

            <div className="rr-card-accent rounded-[30px] p-6">
              <div className="rr-tab-strip inline-flex rounded-full p-1">
                {(["register", "login"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setMode(value);
                      setError(null);
                    }}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold capitalize transition",
                      mode === value
                        ? "rr-tab-active"
                        : "rr-tab-idle",
                    ].join(" ")}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {mode === "register" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium rr-body">
                      Name
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="rr-input w-full rounded-2xl px-4 py-3 transition"
                      placeholder="Josh Mcdonaldson"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium rr-body">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                    placeholder="MocheWave@example.com"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium rr-body">
                    Password
                  </span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="rr-input w-full rounded-2xl px-4 py-3 transition"
                    placeholder="••••••••"
                  />
                </label>

                {error ? (
                  <div className="rr-error rounded-2xl px-4 py-3 text-sm">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!isHydrated}
                  className="rr-primary-btn w-full rounded-2xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mode === "register" ? "Create account" : "Log in"}
                </button>

                <Link href="/" className="rr-link block text-center text-sm underline-offset-4 hover:underline">
                  Back to homepage
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
