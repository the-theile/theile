"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) setError(err.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  // Loading
  if (session === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#faf8f5] text-stone-500">
        Loading…
      </div>
    );
  }

  // Logged in
  if (session) {
    return <>{children}</>;
  }

  // Login screen
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#faf8f5] px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200/80 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-700 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 14c2-1 4-2 6-1 1.5.7 2.5 2 4 2.5 2 .7 4-.2 6-1.5-1 2.5-3.2 4.5-6 5-2.2.4-4-.3-5.5-1.5C6.5 16 5 15 4 14Z"
                fill="currentColor"
              />
              <path
                d="M14 8c1.5-2 3.5-3.2 6-3.5-.5 2-1.5 3.5-3 4.5L14 8Z"
                fill="currentColor"
                opacity="0.7"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">
              Dictabird
            </h1>
            <p className="text-xs text-stone-500">Private · sign in to continue</p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-stone-600">
          Meeting notes and transcripts stay on this device, but access is locked
          so private conversations aren&apos;t open to anyone with the link.
        </p>

        <form onSubmit={signIn} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="dictabird-email"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500"
            >
              Email
            </label>
            <input
              id="dictabird-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-[#faf8f5] px-3 py-3 text-base text-stone-900 outline-none focus:border-sky-600/50 focus:ring-2 focus:ring-sky-600/10"
            />
          </div>
          <div>
            <label
              htmlFor="dictabird-password"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500"
            >
              Password
            </label>
            <input
              id="dictabird-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-[#faf8f5] px-3 py-3 text-base text-stone-900 outline-none focus:border-sky-600/50 focus:ring-2 focus:ring-sky-600/10"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-stone-400">
          Same login as{" "}
          <a href="/gates" className="underline hover:text-stone-600">
            Gates
          </a>
          . No public sign-up — users are added in Supabase.
          <br />
          <a href="/" className="mt-2 inline-block underline hover:text-stone-600">
            ← Back to Theile
          </a>
        </p>
      </div>
    </div>
  );
}

export async function signOutDictabird() {
  await getSupabase().auth.signOut();
}
