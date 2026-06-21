import { notFound } from "next/navigation";
import { LessonViewer } from "@/components/course/LessonViewer";
import { getCourse, COURSES } from "@/lib/data";

export function generateStaticParams() {
  return COURSES.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.map((l) => ({ id: c.id, lessonId: l.id })),
    ),
  );
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const course = getCourse(id);
  if (!course) notFound();

  return <LessonViewer course={course} lessonId={lessonId} />;
}
