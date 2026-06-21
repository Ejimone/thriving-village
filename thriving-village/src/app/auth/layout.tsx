import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-black p-12 text-white lg:flex lg:w-[44%]">
        <Link href="/" aria-label="Thriving Village home">
          <Logo variant="lockup" color="white" height={30} />
        </Link>
        <div>
          <p className="font-serif text-[34px] leading-tight">
            There&apos;s a place for everyone here.
          </p>
          <p className="mt-4 max-w-[420px] text-[17px] leading-relaxed text-gray-400 [letter-spacing:var(--tv-track-tight)]">
            Find work, win contests, learn the craft. Connecting African talent to
            real opportunities.
          </p>
        </div>
        <p className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          © 2026 Thriving Village · Lagos, Nigeria
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          <Link
            href="/"
            aria-label="Thriving Village home"
            className="mb-8 inline-block lg:hidden"
          >
            <Logo variant="lockup" height={28} />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
