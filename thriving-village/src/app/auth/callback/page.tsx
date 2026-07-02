"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { supabaseCallbackAction } from "@/lib/actions/auth";

/**
 * Landing page for Supabase's email-confirmation link. Supabase redirects
 * here with the session in the URL *fragment* (#access_token=...), which
 * only the browser can read — so this page parses it client-side, hands the
 * access token to a server action to exchange for our own session cookie,
 * then replaces the URL (fragment tokens never end up in history/server logs
 * beyond this one hop).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // strict-mode double-invoke guard
    ran.current = true;

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const supabaseError = fragment.get("error_description");
    const accessToken = fragment.get("access_token");

    if (supabaseError) {
      setError(supabaseError);
      return;
    }
    if (!accessToken) {
      setError("This confirmation link is invalid or has expired.");
      return;
    }

    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    supabaseCallbackAction(accessToken, searchParams.get("redirect")).then((result) => {
      if (result.dest) router.replace(result.dest);
      else setError(result.error || "Could not complete sign-in.");
    });
  }, [router, searchParams]);

  return (
    <div>
      <h1 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        {error ? "Something went wrong" : "Confirming your account…"}
      </h1>
      {error ? (
        <>
          <p className="mt-2 text-[15px] text-error [letter-spacing:var(--tv-track-tight)]">{error}</p>
          <p className="mt-4 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            Try signing in — if your email is already confirmed, it will just work.
          </p>
          <div className="mt-6">
            <Button href="/auth/signin" variant="inverse" size="lg" fullWidth>
              Go to sign in
            </Button>
          </div>
          <p className="mt-7 text-center text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            Need a new account?{" "}
            <Link href="/auth/signup" className="font-semibold text-black hover:underline">
              Sign up again
            </Link>
          </p>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          One moment — signing you in.
        </p>
      )}
    </div>
  );
}
