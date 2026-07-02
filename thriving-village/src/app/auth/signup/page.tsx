"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signUpAction, type AuthResult } from "@/lib/actions/auth";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    (_prev, formData) => signUpAction(formData),
    {},
  );

  return (
    <div>
      <h1 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Create your account
      </h1>
      <p className="mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        It takes a minute. There&apos;s a place for everyone here.
      </p>

      {state.message ? (
        <div className="mt-7">
          <p className="rounded-[var(--tv-radius-sm)] bg-gray-100 p-4 text-[15px] text-gray-800 [letter-spacing:var(--tv-track-tight)]">
            {state.message}
          </p>
          <p className="mt-4 text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            Once you&apos;ve clicked the link, you&apos;ll be signed in automatically. Wrong email?
            Just submit the form again.
          </p>
        </div>
      ) : (
      <form action={formAction} className="mt-7 flex flex-col gap-4">
        <input type="hidden" name="role" value="talent" />
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
        <Input name="name" label="Full name" placeholder="Your name" required />
        <Input name="email" label="Email" type="email" placeholder="you@example.com" required />
        <Input name="password" label="Password" type="password" placeholder="••••••••" required />
        <p className="-mt-1 text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          We&apos;ll ask for your WhatsApp number when you apply, enter, or enroll.
        </p>
        {state.error && (
          <p className="text-[13px] text-error [letter-spacing:var(--tv-track-tight)]">{state.error}</p>
        )}
        <Button type="submit" variant="inverse" size="lg" fullWidth disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      )}

      <p className="mt-6 text-center text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Already have an account?{" "}
        <Link
          href={redirectTo ? `/auth/signin?redirect=${encodeURIComponent(redirectTo)}` : "/auth/signin"}
          className="font-semibold text-black hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
