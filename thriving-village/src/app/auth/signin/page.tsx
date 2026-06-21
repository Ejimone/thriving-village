"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { WHATSAPP_URL } from "@/lib/data";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Placeholder — no real auth in this skin.
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.info("Auth is wired up by the dev team. This is a UI placeholder.");
    }, 600);
  }

  return (
    <div>
      <h1 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Welcome back
      </h1>
      <p className="mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Sign in to pick up where you left off.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="you@example.com" required />
        <Input label="Password" type="password" placeholder="••••••••" required />
        <div className="flex justify-end -mt-1">
          <Link
            href="#"
            className="text-[13px] font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="inverse" size="lg" fullWidth disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
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
        <Link href="/auth/signup" className="font-semibold text-black hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
