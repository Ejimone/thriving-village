import { CoursesAdmin } from "@/components/admin/CoursesAdmin";
import { getCourses, getCourse } from "@/lib/data";

export default async function AdminCoursesPage() {
  const { items: list } = await getCourses({ pageSize: 50 });
  // The list endpoint never populates modules (kept light for the public catalog) —
  // admin editing needs the full curriculum, so fetch each course's detail.
  const courses = await Promise.all(list.map((c) => getCourse(c.id)));
  return <CoursesAdmin courses={courses.filter((c): c is NonNullable<typeof c> => c !== null)} />;
}
