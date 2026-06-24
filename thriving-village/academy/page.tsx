"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toaster";
import { ROLES } from "@/lib/cohort";

/**
 * The Academy's own sign-in screen — its entry point as a separate property.
 * Frontend skin only: "signing in" just routes into the app. A role chooser is
 * provided so every role can be previewed during review.
 */
export default function AcademySignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Enter your email and password to sign in.");
      return;
    }
    router.push("/academy/student");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-[920px] items-center gap-12 lg:grid-cols-2">
        {/* Brand / welcome */}
        <div className="hidden flex-col gap-6 lg:flex">
          <div className="flex items-center gap-3">
            <Logo variant="lockup" height={26} />
            <Badge tone="neutral" size="sm">
              Academy
            </Badge>
          </div>
          <h1 className="font-serif text-[clamp(32px,5vw,46px)] leading-[1.05] text-black">
            Learn the craft, one day at a time.
          </h1>
          <p className="max-w-[42ch] text-[17px] leading-relaxed text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            Cohort-based courses with a facilitator, a community, and a clear path.
            You always know where you are and what to do next.
          </p>
          <ul className="flex flex-col gap-3 text-[15px] text-gray-700 [letter-spacing:var(--tv-track-tight)]">
            <li className="flex items-center gap-2.5">
              <GraduationCap size={18} className="text-gray-400" /> One lesson and one
              task a day — nothing more to decide.
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-gray-400" /> A facilitator reviews
              each week before the next opens.
            </li>
          </ul>
        </div>

        {/* Sign-in card */}
        <div className="rounded-card border border-gray-200 bg-white p-7 shadow-md sm:p-9">
          {/* Compact brand for narrow screens */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo variant="lockup" height={22} />
            <Badge tone="neutral" size="sm">
              Academy
            </Badge>
          </div>

          <h2 className="text-[24px] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
            Sign in
          </h2>
          <p className="mt-1.5 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            Welcome back. Pick up where you left off.
          </p>

          <form onSubmit={signIn} className="mt-6 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="inverse" fullWidth iconRight={<ArrowRight size={18} />}>
              Sign in
            </Button>
          </form>

          {/* Review aid: jump straight into any role */}
          <div className="mt-7 border-t border-gray-200 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
              For review — sign in as
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push(`/academy/${r.id}`)}
                  className="rounded-sm border border-gray-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-black"
                >
                  <span className="block text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {r.label}
                  </span>
                  <span className="block text-[12px] text-gray-500">{r.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
