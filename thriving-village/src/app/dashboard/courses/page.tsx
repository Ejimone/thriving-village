import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { MY_COURSES, getCourse, photo } from "@/lib/data";

export default function MyCoursesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          My courses
        </h1>
        <p className="mt-2 text-[16px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          Pick up where you left off, or finish what you started.
        </p>
      </div>

      {MY_COURSES.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={22} />}
          title="You haven't enrolled yet"
          body="Browse the catalog and start building your skills."
          action={
            <Button href="/courses" variant="inverse">
              Browse courses
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {MY_COURSES.map((mc) => {
            const course = getCourse(mc.courseId)!;
            const done = mc.progress >= 100;
            const firstLesson = course.modules[0].lessons[0];
            return (
              <Card key={mc.courseId} padded={false} className="flex flex-col gap-4 sm:flex-row">
                <div className="h-36 w-full flex-none bg-gray-900 sm:h-auto sm:w-[140px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo(course.seed, 280, 360)}
                    alt=""
                    className="h-full w-full object-cover tv-photo"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral" size="sm">
                      {course.field}
                    </Badge>
                    {done && (
                      <Badge tone="inverse" size="sm">
                        Completed
                      </Badge>
                    )}
                  </div>
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-[19px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
                  >
                    {course.title}
                  </Link>
                  <ProgressBar value={mc.progress} showLabel />
                  <div className="mt-auto">
                    <Button
                      href={`/courses/${course.id}/lessons/${firstLesson.id}`}
                      variant={done ? "outline" : "inverse"}
                      size="sm"
                    >
                      {done ? "Review course" : "Continue learning"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
