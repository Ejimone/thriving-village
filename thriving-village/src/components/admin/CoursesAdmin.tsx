"use client";

import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AdminCrud, PENDING_NEW_ID, type AdminRow } from "@/components/admin/AdminCrud";
import { saveCourseAction, deleteCourseAction } from "@/lib/actions/admin";
import { naira } from "@/lib/data";
import type { Course, CourseDelivery, CourseKind, Field } from "@/lib/data";

const blankCourse: Course = {
  id: "",
  dbId: 0,
  documentId: "",
  title: "",
  field: "Digital",
  level: "Entry",
  kind: "Course",
  delivery: "Online",
  instructor: "",
  instructorRole: "",
  price: 0,
  weeks: 0,
  lessonCount: 0,
  seed: "",
  blurb: "",
  outcomes: [],
  modules: [],
};

function buildRow(c: Course): AdminRow {
  return {
    id: c.documentId,
    label: c.title,
    cells: [
      c.title,
      <Badge key="f" tone="neutral" size="sm">
        {c.field}
      </Badge>,
      c.kind,
      c.delivery,
      naira(c.price),
    ],
  };
}

export function CoursesAdmin({ courses }: { courses: Course[] }) {
  const byId = new Map(courses.map((c) => [c.documentId, c]));

  const rows: AdminRow[] = courses.map(buildRow);

  function previewRow(documentId: string | null, formData: FormData): AdminRow {
    const existing = documentId ? byId.get(documentId) : undefined;
    const get = (k: string, fallback: string) => String(formData.get(k) ?? fallback);
    return buildRow({
      ...(existing ?? blankCourse),
      documentId: documentId ?? PENDING_NEW_ID,
      title: get("title", existing?.title ?? ""),
      field: get("field", existing?.field ?? "Digital") as Field,
      kind: get("kind", existing?.kind ?? "Course") as CourseKind,
      delivery: get("delivery", existing?.delivery ?? "Online") as CourseDelivery,
      price: Number(formData.get("price") ?? existing?.price ?? 0),
    });
  }

  function renderForm(documentId: string | null) {
    const course = documentId ? byId.get(documentId) : undefined;
    return (
      <>
        <Input name="title" label="Course title" placeholder="e.g. Intro to UI Design" defaultValue={course?.title} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="field"
            label="Field"
            defaultValue={course?.field}
            options={[
              { label: "Digital", value: "Digital" },
              { label: "Technical", value: "Technical" },
              { label: "Craft", value: "Craft" },
              { label: "Creative", value: "Creative" },
            ]}
          />
          <Select
            name="level"
            label="Level"
            defaultValue={course?.level}
            options={[
              { label: "Entry", value: "Entry" },
              { label: "Mid", value: "Mid" },
              { label: "Senior", value: "Senior" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="kind"
            label="Type"
            defaultValue={course?.kind}
            options={[
              { label: "Course", value: "Course" },
              { label: "Certification", value: "Certification" },
            ]}
          />
          <Select
            name="delivery"
            label="Delivery"
            defaultValue={course?.delivery}
            options={[
              { label: "Online", value: "Online" },
              { label: "Onsite", value: "Onsite" },
              { label: "Hybrid", value: "Hybrid" },
            ]}
          />
        </div>
        <Input name="location" label="Location (if onsite/hybrid)" placeholder="e.g. Lagos" defaultValue={course?.location} />
        <div className="grid grid-cols-2 gap-4">
          <Input name="instructor" label="Instructor" defaultValue={course?.instructor} required />
          <Input name="instructorRole" label="Instructor role" defaultValue={course?.instructorRole} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input name="price" label="Price (₦)" type="number" min={0} defaultValue={course?.price} required />
          <Input name="weeks" label="Weeks" type="number" min={1} defaultValue={course?.weeks} required />
        </div>
        <Textarea name="blurb" label="Blurb" rows={3} defaultValue={course?.blurb} required />
        <Textarea
          name="outcomes"
          label="What you'll learn (one per line)"
          rows={4}
          placeholder={"Build a portfolio site\nDesign for mobile"}
          defaultValue={course?.outcomes.join("\n")}
        />
        <Textarea
          name="modules"
          label="Curriculum (JSON array)"
          rows={8}
          placeholder='[{"title":"Module 1","lessons":[{"key":"l1","title":"Intro","duration":"10 min","free":true}]}]'
          defaultValue={course ? JSON.stringify(course.modules.map((m) => ({
            title: m.title,
            lessons: m.lessons.map((l) => ({ key: l.id, title: l.title, duration: l.duration, free: l.free })),
          })), null, 2) : ""}
          hint="Each module needs a title and lessons[]. Each lesson needs a stable key (don't change after publishing), title, duration, free."
        />
      </>
    );
  }

  return (
    <AdminCrud
      title="Courses"
      subtitle="Create and manage the course catalog."
      newLabel="New course"
      noun="course"
      columns={["Title", "Field", "Type", "Delivery", "Price"]}
      rows={rows}
      renderForm={renderForm}
      onSave={saveCourseAction}
      onDelete={deleteCourseAction}
      previewRow={previewRow}
    />
  );
}
