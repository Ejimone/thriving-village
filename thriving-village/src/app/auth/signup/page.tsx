"use client";

import Link from "next/link";
import { useState } from "react";
import { Briefcase, Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

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
  const [role, setRole] = useState<Role>("talent");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.info("Sign-up is wired up by the dev team. This is a UI placeholder.");
    }, 600);
  }

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

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <Input label="Full name" placeholder="Your name" required />
        <Input label="Email" type="email" placeholder="you@example.com" required />
        <Input
          label="WhatsApp number"
          placeholder="+234 ..."
          hint="We reach you here — the community lives on WhatsApp."
          required
        />
        <Input label="Password" type="password" placeholder="••••••••" required />
        <Button type="submit" variant="inverse" size="lg" fullWidth disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Already have an account?{" "}
        <Link href="/auth/signin" className="font-semibold text-black hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
