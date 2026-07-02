"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { forgotPasswordAction, type AuthResult } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    (_prev, formData) => forgotPasswordAction(formData),
    {},
  );

  return (
    <div>
      <h1 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Reset your password
      </h1>
      <p className="mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Enter your email and we&apos;ll send you a link to set a new one.
      </p>

      {state.message ? (
        <div className="mt-7">
          <p className="rounded-[var(--tv-radius-sm)] bg-gray-100 p-4 text-[15px] text-gray-800 [letter-spacing:var(--tv-track-tight)]">
            {state.message}
          </p>
          <p className="mt-4 text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            The link expires in 2 hours. Didn&apos;t get it? Check your spam folder, or try again in a
            few minutes.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-7 flex flex-col gap-4">
          <Input name="email" label="Email" type="email" placeholder="you@example.com" required />
          {state.error && (
            <p className="text-[13px] text-error [letter-spacing:var(--tv-track-tight)]">{state.error}</p>
          )}
          <Button type="submit" variant="inverse" size="lg" fullWidth disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-7 text-center text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Remembered it?{" "}
        <Link href="/auth/signin" className="font-semibold text-black hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
