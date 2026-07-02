"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/lib/data";
import { signInAction, type AuthResult } from "@/lib/actions/auth";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    (_prev, formData) => signInAction(formData),
    {},
  );

  return (
    <div>
      <h1 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Welcome back
      </h1>
      <p className="mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Sign in to pick up where you left off.
      </p>

      <form action={formAction} className="mt-7 flex flex-col gap-4">
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
        <Input name="email" label="Email" type="email" placeholder="you@example.com" required />
        <Input name="password" label="Password" type="password" placeholder="••••••••" required />
        {state.error && (
          <p className="text-[13px] text-error [letter-spacing:var(--tv-track-tight)]">{state.error}</p>
        )}
        <div className="flex justify-end -mt-1">
          <Link
            href="/auth/forgot-password"
            className="text-[13px] font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="inverse" size="lg" fullWidth disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[13px] text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <Button
        href={WHATSAPP_URL}
        variant="outline"
        size="lg"
        fullWidth
        iconLeft={<MessageCircle size={18} />}
      >
        Continue on WhatsApp
      </Button>

      <p className="mt-7 text-center text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        New here?{" "}
        <Link
          href={redirectTo ? `/auth/signup?redirect=${encodeURIComponent(redirectTo)}` : "/auth/signup"}
          className="font-semibold text-black hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
