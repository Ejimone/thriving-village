"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { signUpAction, type AuthResult } from "@/lib/actions/auth";

type Role = "talent" | "employer";

const ROLES: { value: Role; title: string; body: string; icon: React.ReactNode }[] =
  [
    {
      value: "talent",
      title: "I'm talent",
      body: "Find work, enter contests, take courses.",
      icon: <Briefcase size={20} />,
    },
    {
      value: "employer",
      title: "I'm hiring",
      body: "Post roles and discover people.",
      icon: <Building2 size={20} />,
    },
  ];

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [role, setRole] = useState<Role>("talent");
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

      {/* Role selector */}
      <div className="mt-7">
        <p className="mb-2.5 text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          I&apos;m joining as
        </p>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const active = role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col gap-2 rounded-card border-[1.5px] p-4 text-left transition-colors",
                  active
                    ? "border-black bg-gray-50"
                    : "border-gray-200 hover:border-gray-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-pill",
                    active ? "bg-black text-white" : "bg-gray-150 text-gray-600",
                  )}
                >
                  {r.icon}
                </span>
                <span className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  {r.title}
                </span>
                <span className="text-[13px] leading-snug text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                  {r.body}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="role" value={role} />
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
