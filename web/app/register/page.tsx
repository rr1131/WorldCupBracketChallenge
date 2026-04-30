"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app/AppHeader";
import { useAppData } from "@/components/providers/AppDataProvider";

type Mode = "register" | "login";

export default function RegisterPage() {
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

  function submit() {
    const outcome =
      mode === "register"
        ? registerUser({ name, email, password })
        : loginUser({ email, password });

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }

    router.push(nextHref);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#153b63_0%,#0b2442_32%,#06111d_68%,#040910_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,26,43,0.95),rgba(14,47,77,0.92))] p-6 shadow-[0_40px_120px_rgba(2,6,23,0.5)] md:p-8">
          <AppHeader showWorkspaceLink={false} />

          <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/78">
                Access
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
                Register or log in to manage entries and pools.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-cyan-100/72">
                This prototype keeps accounts in local browser storage so you can test the
                full signed-in flow right away.
              </p>

              <div className="mt-8 rounded-[28px] border border-white/10 bg-white/6 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/58">
                  Demo accounts
                </div>
                <div className="mt-4 space-y-3 text-sm text-cyan-50/80">
                  <div>`maya@example.com` / `demo1234`</div>
                  <div>`luca@example.com` / `demo1234`</div>
                  <div>`priya@example.com` / `demo1234`</div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-amber-300/18 bg-[linear-gradient(170deg,rgba(247,222,136,0.12),rgba(255,255,255,0.03))] p-6">
              <div className="inline-flex rounded-full border border-white/10 bg-white/6 p-1">
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
                        ? "bg-[linear-gradient(135deg,#f7de88,#e4ad35)] text-slate-950"
                        : "text-white/72 hover:text-white",
                    ].join(" ")}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {mode === "register" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-cyan-100/68">
                      Name
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                      placeholder="Rodrigo"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-cyan-100/68">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                    placeholder="name@example.com"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-cyan-100/68">
                    Password
                  </span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                    placeholder="••••••••"
                  />
                </label>

                {error ? (
                  <div className="rounded-2xl border border-red-400/28 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!isHydrated}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#f7de88,#e4ad35)] px-5 py-3 font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mode === "register" ? "Create account" : "Log in"}
                </button>

                <Link href="/" className="block text-center text-sm text-cyan-100/65 underline-offset-4 hover:underline">
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
