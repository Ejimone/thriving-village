"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { resetPasswordAction, type AuthResult } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    (_prev, formData) => resetPasswordAction(formData),
    {},
  );

  return (
    <div>
      <h1 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Choose a new password
      </h1>
      <p className="mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        {code
          ? "Set a new password for your account. You'll be signed in right after."
          : "Open this page from the link in your reset email, or paste the code below."}
      </p>

      <form action={formAction} className="mt-7 flex flex-col gap-4">
        {code ? (
          <input type="hidden" name="code" value={code} />
        ) : (
          <Input name="code" label="Reset code" placeholder="Paste the code from your email" required />
        )}
        <Input name="password" label="New password" type="password" placeholder="••••••••" required />
        <Input
          name="passwordConfirmation"
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          required
        />
        {state.error && (
          <p className="text-[13px] text-error [letter-spacing:var(--tv-track-tight)]">
            {state.error}{" "}
            <Link href="/auth/forgot-password" className="font-semibold text-black hover:underline">
              Request a new link
            </Link>
          </p>
        )}
        <Button type="submit" variant="inverse" size="lg" fullWidth disabled={pending}>
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>

      <p className="mt-7 text-center text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Remembered it?{" "}
        <Link href="/auth/signin" className="font-semibold text-black hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
