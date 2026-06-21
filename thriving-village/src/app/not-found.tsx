import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo variant="icon" height={44} />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
          404
        </p>
        <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          We can&apos;t find that page.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[17px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          The link may be old or the page may have moved. Let&apos;s get you back.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button href="/" variant="inverse">
          Back home
        </Button>
        <Button href="/jobs" variant="outline">
          Browse jobs
        </Button>
      </div>
    </div>
  );
}
