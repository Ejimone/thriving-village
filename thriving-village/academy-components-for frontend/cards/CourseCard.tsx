import Link from "next/link";
import { MapPin, Award } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { naira, photo, type Course } from "@/lib/data";

/** Reusable course card. Horizontal layout with grayscale image. */
export function CourseCard({ course }: { course: Course }) {
  const deliveryLabel =
    course.delivery === "Online"
      ? "Online"
      : `${course.delivery}${course.location ? ` · ${course.location}` : ""}`;

  return (
    <Card padded={false} className="flex flex-col sm:flex-row">
      <div className="h-40 w-full flex-none bg-gray-900 sm:h-auto sm:w-[150px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(course.seed, 300, 400)}
          alt=""
          className="h-full w-full object-cover tv-photo"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" size="sm">
            {course.field}
          </Badge>
          {course.kind === "Certification" && (
            <Badge tone="outline" size="sm">
              <Award size={12} />
              Certification
            </Badge>
          )}
          <Badge tone="outline" size="sm">
            {course.level}
          </Badge>
        </div>
        <Link
          href={`/courses/${course.id}`}
          className="text-[21px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
        >
          {course.title}
        </Link>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          <MapPin size={13} className="text-gray-400" />
          {deliveryLabel} · {course.weeks} weeks · {course.lessonCount} lessons
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            {naira(course.price)}
          </span>
          <Button href={`/courses/${course.id}`} variant="inverse" size="sm">
            View course
          </Button>
        </div>
      </div>
    </Card>
  );
}
