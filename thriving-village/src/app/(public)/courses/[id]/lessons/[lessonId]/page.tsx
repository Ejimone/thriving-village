import { notFound } from "next/navigation";
import { LessonViewer } from "@/components/course/LessonViewer";
import { getCourse, getCourseLessonProgress } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  const session = await getSession();
  const completed = session ? await getCourseLessonProgress(session.jwt, course.dbId) : new Set<string>();

  return <LessonViewer course={course} lessonId={lessonId} initialCompleted={[...completed]} />;
}
