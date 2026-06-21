import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  PlayCircle,
  Check,
  Lock,
  BarChart3,
  MapPin,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ApplyDialog } from "@/components/cards/ApplyDialog";
import { getCourse, naira } from "@/lib/data";
import { enrollInCourseAction } from "@/lib/actions/applications";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  const firstLesson = course.modules[0]?.lessons[0];

  return (
    <div className="tv-container pt-10 pb-4">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
      >
        <ArrowLeft size={16} /> All courses
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="neutral" size="md">
              {course.field}
            </Badge>
            {course.kind === "Certification" && (
              <Badge tone="outline" size="md">
                <Award size={14} />
                Certification
              </Badge>
            )}
            <Badge tone="outline" size="md">
              {course.level}
            </Badge>
          </div>
          <h1 className="mt-4 text-[clamp(30px,5vw,44px)] font-bold leading-[1.05] text-black [letter-spacing:var(--tv-track-tighter)]">
            {course.title}
          </h1>
          <p className="mt-4 max-w-[640px] text-[19px] leading-snug text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            {course.blurb}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            <span className="flex items-center gap-2">
              <MapPin size={16} className="text-gray-400" />
              {course.delivery === "Online"
                ? "Online"
                : `${course.delivery}${course.location ? ` · ${course.location}` : ""}`}
            </span>
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" /> {course.weeks} weeks
            </span>
            <span className="flex items-center gap-2">
              <PlayCircle size={16} className="text-gray-400" />{" "}
              {course.lessonCount} lessons
            </span>
            <span className="flex items-center gap-2">
              <BarChart3 size={16} className="text-gray-400" /> {course.level}{" "}
              level
            </span>
            {course.kind === "Certification" && (
              <span className="flex items-center gap-2">
                <Award size={16} className="text-gray-400" /> Certificate on
                completion
              </span>
            )}
          </div>

          {/* What you'll learn */}
          <h2 className="mt-10 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            What you&apos;ll learn
          </h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {course.outcomes.map((o) => (
              <li
                key={o}
                className="flex items-start gap-3 text-base text-gray-700 [letter-spacing:var(--tv-track-tight)]"
              >
                <Check size={18} className="mt-0.5 flex-none text-black" />
                {o}
              </li>
            ))}
          </ul>

          {/* Curriculum */}
          <h2 className="mt-10 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            Curriculum
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            {course.modules.map((m, mi) => (
              <Card key={m.title} variant="flat" className="!p-0">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
                  <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    Module {mi + 1} · {m.title}
                  </p>
                  <span className="text-[13px] text-gray-500">
                    {m.lessons.length} lessons
                  </span>
                </div>
                <ul>
                  {m.lessons.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-3 px-5 py-3 text-[15px] text-gray-700 [letter-spacing:var(--tv-track-tight)]"
                    >
                      {l.free ? (
                        <PlayCircle size={16} className="text-black" />
                      ) : (
                        <Lock size={15} className="text-gray-400" />
                      )}
                      <span className="flex-1">{l.title}</span>
                      <span className="text-[13px] text-gray-500">
                        {l.duration}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {/* Instructor */}
          <h2 className="mt-10 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            Your instructor
          </h2>
          <Card className="mt-3 flex items-center gap-4">
            <Avatar name={course.instructor} size={56} />
            <div>
              <p className="text-[17px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                {course.instructor}
              </p>
              <p className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                {course.instructorRole}
              </p>
            </div>
          </Card>
        </div>

        {/* Enroll rail */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <Card className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                One-time price
              </p>
              <p className="text-[32px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                {naira(course.price)}
              </p>
            </div>
            <ApplyDialog
              fullWidth
              label="Enroll now"
              title={`Enroll — ${course.title}`}
              subtitle={`${naira(course.price)} · lifetime access`}
              promptLabel="Anything you'd like us to know? (optional)"
              successMessage="You're enrolled. Start learning anytime."
              action={enrollInCourseAction.bind(null, course.id)}
            />
            {firstLesson && (
              <Button
                href={`/courses/${course.id}/lessons/${firstLesson.id}`}
                variant="outline"
                fullWidth
              >
                Preview a free lesson
              </Button>
            )}
            <p className="text-center text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              Lifetime access · learn at your pace
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
