import Link from "next/link";
import { MessageCircle, ArrowRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { JobCard } from "@/components/cards/JobCard";
import { ContestCard } from "@/components/cards/ContestCard";
import { BrandCard } from "@/components/cards/BrandCard";
import {
  getJobs,
  getContests,
  getBrands,
  getTestimonials,
  WHATSAPP_URL,
  photo,
} from "@/lib/data";

const PATHS = [
  {
    kicker: "Job board",
    title: "Ready to work",
    body: "Roles from our sister businesses and partner companies. Apply today.",
    cta: "Browse jobs",
    href: "/jobs",
  },
  {
    kicker: "Contests",
    title: "Win cash prizes",
    body: "We discover the best people and reward them. Show what you can do.",
    cta: "See contests",
    href: "/contests",
  },
  {
    kicker: "Courses",
    title: "Still building skills",
    body: "Paid courses in every field we serve. Learn, then earn.",
    cta: "Start learning",
    href: "/courses",
  },
];

export default async function HomePage() {
  const [{ items: featuredJobs }, { items: liveContests }, featuredBrands, testimonials] =
    await Promise.all([
      getJobs({ pageSize: 3 }),
      getContests({ status: "live", pageSize: 3 }),
      getBrands({ featured: true }),
      getTestimonials(),
    ]);

  return (
    <div>
      {/* Hero */}
      <section className="tv-container pt-16 pb-14 sm:pt-20">
        <div className="max-w-[880px]">
          <Badge tone="outline" size="md">
            Starting in Nigeria · Across Africa
          </Badge>
          <h1 className="mt-5 text-[clamp(44px,8vw,72px)] font-bold leading-[1.02] text-black [letter-spacing:var(--tv-track-tighter)]">
            There&apos;s a place
            <br />
            for everyone here.
          </h1>
          <p className="mt-6 max-w-[600px] text-[clamp(18px,2.4vw,21px)] leading-snug text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            We connect African talent to real opportunities. Whether you code,
            build, fix, design, or make — find work, win contests, learn the
            craft.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/jobs" variant="inverse" size="lg">
              Find work
            </Button>
            <Button href="/contests" variant="outline" size="lg">
              See contests
            </Button>
          </div>
        </div>
      </section>

      {/* Three ways */}
      <section className="tv-container pt-6">
        <div className="grid gap-5 md:grid-cols-3">
          {PATHS.map((p) => (
            <Card key={p.title} className="flex min-h-[220px] flex-col gap-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
                {p.kicker}
              </p>
              <h3 className="text-2xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                {p.title}
              </h3>
              <p className="flex-1 text-[15px] leading-snug text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                {p.body}
              </p>
              <div>
                <Button href={p.href} variant="text">
                  {p.cta} <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Imagery + community band */}
      <section className="tv-container mt-18 pt-2">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative min-h-[360px] overflow-hidden rounded-card bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo("tv-craft", 900, 700)}
              alt="A maker at work"
              className="h-full w-full object-cover tv-photo"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.7),transparent_55%)]" />
            <p className="font-serif absolute bottom-6 left-6 m-0 text-[26px] leading-snug text-white">
              The craft behind the work.
            </p>
          </div>
          <Card
            variant="inverse"
            className="flex flex-col justify-center !p-12"
          >
            <p className="text-[13px] font-bold uppercase tracking-[0.05em] text-gray-500">
              The community
            </p>
            <p className="mb-4 mt-3 text-[28px] font-bold leading-[1.15] [letter-spacing:var(--tv-track-tight)]">
              It all happens on WhatsApp.
            </p>
            <p className="mb-6 text-base leading-snug text-gray-300 [letter-spacing:var(--tv-track-tight)]">
              Jobs, contests, support, and real connection — where people already
              are.
            </p>
            <div>
              <Button
                href={WHATSAPP_URL}
                variant="inverse"
                iconLeft={<MessageCircle size={18} />}
                className="!bg-[#25D366] !border-[#25D366] !text-white hover:!bg-[#1DA851]"
              >
                Join the community
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Featured jobs */}
      <section className="tv-container mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
              Featured work
            </h2>
            <p className="mt-2 text-[17px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
              Fresh roles from our sister businesses and partners.
            </p>
          </div>
          <Button href="/jobs" variant="text" className="hidden sm:inline-flex">
            All jobs <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {featuredJobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      </section>

      {/* Live contests */}
      <section className="tv-container mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            Live contests
          </h2>
          <Button
            href="/contests"
            variant="text"
            className="hidden sm:inline-flex"
          >
            All contests <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {liveContests.map((c) => (
            <ContestCard key={c.id} contest={c} variant="list" />
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="tv-container mt-20">
        <h2 className="mb-6 text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          Real work, real people
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.slice(0, 3).map((t, i) => (
            <Card key={`${t.name}-${i}`} className="flex flex-col gap-4">
              <Quote size={22} className="text-gray-300" />
              <p className="font-serif flex-1 text-[17px] leading-relaxed text-gray-800">
                {t.quote}
              </p>
              <div>
                <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  {t.name}
                </p>
                <p className="text-sm text-gray-500">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured brands */}
      <section className="tv-container mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
              Featured brands
            </h2>
            <p className="mt-2 text-[17px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
              The businesses and partners building alongside our community.
            </p>
          </div>
          <Button href="/brands" variant="text" className="hidden sm:inline-flex">
            All brands <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {featuredBrands.slice(0, 3).map((b) => (
            <BrandCard key={b.id} brand={b} featured />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="tv-container mt-20">
        <Card variant="inverse" className="!p-12 text-center sm:!p-16">
          <h2 className="mx-auto max-w-[640px] text-[clamp(28px,5vw,44px)] font-bold leading-[1.05] [letter-spacing:var(--tv-track-tighter)]">
            Find your work. Win cash. Learn the craft.
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[17px] text-gray-300 [letter-spacing:var(--tv-track-tight)]">
            It all starts in the community. Join thousands already building their
            future.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              href={WHATSAPP_URL}
              size="lg"
              variant="inverse"
              iconLeft={<MessageCircle size={18} />}
              className="!bg-[#25D366] !border-[#25D366] !text-white hover:!bg-[#1DA851]"
            >
              Join on WhatsApp
            </Button>
            <Button
              href="/auth/signup"
              size="lg"
              variant="inverse"
              className="!border-gray-700 hover:!bg-gray-900"
            >
              Create an account
            </Button>
          </div>
        </Card>
      </section>

      <p className="tv-container mt-12 text-center text-sm text-gray-500">
        New here?{" "}
        <Link href="/about" className="font-semibold text-black hover:underline">
          Learn how Thriving Village works
        </Link>
      </p>
    </div>
  );
}
