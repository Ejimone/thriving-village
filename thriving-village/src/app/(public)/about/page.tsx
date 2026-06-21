import { MessageCircle, Briefcase, Trophy, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { WHATSAPP_URL, photo } from "@/lib/data";

const TEAM = [
  { name: "Founder", role: "Vision & direction" },
  { name: "Talent Lead", role: "Jobs & partners" },
  { name: "Contests Lead", role: "Discovery & prizes" },
  { name: "Learning Lead", role: "Courses & craft" },
];

const WAYS = [
  {
    icon: <Briefcase size={20} />,
    title: "Job board",
    body: "Ready talent, real roles from our sister businesses and partner companies.",
  },
  {
    icon: <Trophy size={20} />,
    title: "Contests",
    body: "Talent competitions with cash prizes — we discover the best people and reward them.",
  },
  {
    icon: <GraduationCap size={20} />,
    title: "Courses",
    body: "Paid courses for people still building their skills, in any field we serve.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Mission */}
      <section className="tv-container pt-16 pb-4">
        <div className="max-w-[820px]">
          <Badge tone="outline" size="md">
            Our mission
          </Badge>
          <h1 className="mt-5 text-[clamp(36px,7vw,64px)] font-bold leading-[1.03] text-black [letter-spacing:var(--tv-track-tighter)]">
            Human empowerment, across Africa.
          </h1>
          <p className="mt-6 text-[clamp(18px,2.4vw,22px)] leading-snug text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            Thriving Village connects African talent to real opportunities.
            Whether someone codes, builds, fixes, designs, or makes — there&apos;s
            a place for them here. We&apos;re mission-driven, and a real business:
            empowering people is the goal, sustainability is how we keep going.
          </p>
        </div>
      </section>

      {/* Story + image */}
      <section className="tv-container mt-12">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="relative min-h-[340px] overflow-hidden rounded-card bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo("tv-story", 800, 700)}
              alt="People at work"
              className="h-full w-full object-cover tv-photo"
            />
          </div>
          <div className="flex flex-col justify-center gap-4">
            <h2 className="text-[clamp(26px,4vw,36px)] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
              The story
            </h2>
            <p className="font-serif text-[18px] leading-relaxed text-gray-800">
              We started in Nigeria, where talent is everywhere but opportunity is
              not always easy to reach. We built one place where work, recognition,
              and learning meet.
            </p>
            <p className="text-[17px] leading-relaxed text-gray-700 [letter-spacing:var(--tv-track-tight)]">
              The community already lived on WhatsApp, so that&apos;s where it
              stays. The platform handles the work; the connection stays human.
            </p>
          </div>
        </div>
      </section>

      {/* Three ways */}
      <section id="partners" className="tv-container mt-20 scroll-mt-20">
        <h2 className="mb-6 text-[clamp(26px,4vw,36px)] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          We do this in three ways
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {WAYS.map((w) => (
            <Card key={w.title} className="flex flex-col gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-gray-150 text-black">
                {w.icon}
              </span>
              <h3 className="text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                {w.title}
              </h3>
              <p className="text-[15px] leading-snug text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                {w.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Team placeholder */}
      <section className="tv-container mt-20">
        <h2 className="mb-6 text-[clamp(26px,4vw,36px)] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          The team
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((p) => (
            <Card key={p.role} className="flex flex-col items-center gap-3 text-center">
              <Avatar name={p.name} size={72} />
              <div>
                <p className="text-[17px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  {p.name}
                </p>
                <p className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                  {p.role}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="tv-container mt-20 scroll-mt-20">
        <Card variant="inverse" className="!p-12 text-center sm:!p-16">
          <h2 className="text-[clamp(26px,5vw,40px)] font-bold leading-[1.05] [letter-spacing:var(--tv-track-tighter)]">
            It all happens on WhatsApp.
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[17px] text-gray-300 [letter-spacing:var(--tv-track-tight)]">
            Questions, partnerships, or just want in? Come say hello.
          </p>
          <div className="mt-7">
            <Button
              href={WHATSAPP_URL}
              size="lg"
              variant="inverse"
              iconLeft={<MessageCircle size={18} />}
              className="!bg-white !text-black !border-white hover:!bg-gray-100"
            >
              Join the community
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
