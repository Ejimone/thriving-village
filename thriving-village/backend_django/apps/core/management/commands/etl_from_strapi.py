"""One-time ETL: copies Strapi's existing Postgres tables into the new
Django-native tables, in the same Supabase project (per the approved plan —
no new database, no Strapi-table changes, Django just gets its own fresh
tables alongside them).

Usage:
    python manage.py etl_from_strapi --dry-run   # exercises every write,
                                                  # then rolls back the
                                                  # whole transaction
    python manage.py etl_from_strapi             # commits for real

Design notes:
- Reads Strapi's tables with raw SQL (`django.db.connection`, same
  connection Django already has open — no second DB credential needed).
  Writes go through the Django ORM so model validation/constraints apply.
- Idempotency strategy, by content-type:
  - Has a real natural key in our schema (User.email, */slug,
    AcademyMaterial(course,day), AcademySubmission.anon_handle, and the
    five unique_together ownership relations from Stage 3) -> upsert via
    `update_or_create`. Safe to re-run any number of times.
  - No natural key in our schema AND no dependents (Brand, Testimonial) ->
    wipe-all-and-recreate every run. Trivial data volight, no relations
    point at them, so this is exactly as correct as an upsert.
  - Repeatable components promoted to child tables (Contest.prizes,
    Course.modules/lessons) -> wholesale delete-and-recreate per parent,
    same semantics the write serializers already use for these (Stage 2/3).
  - The entire Academy cohort-rooted subtree (AcademyCohort and everything
    that cascades from it: Enrollment/Submission/Judgment/Team/
    LiveSession/RosterRequest/Certificate) has no natural key on Cohort
    itself, so the whole subtree is wiped and rebuilt from source each
    run. AcademyCategory/AcademyCourse/AcademyMaterial sit *outside* this
    subtree (Material FKs to Course, not Cohort) and keep their own
    natural-key upserts, so they're untouched by a cohort rebuild.
- Old Strapi row id -> new Django pk maps are built in-memory, per
  content-type, as the run progresses (per the plan — no persisted
  "legacy id" column added to any model).
- Execution order respects FK dependencies throughout.
"""

import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.academy.models import (
    AcademyCategory,
    AcademyCertificate,
    AcademyCohort,
    AcademyCourse,
    AcademyEnrollment,
    AcademyJudgment,
    AcademyLiveSession,
    AcademyMaterial,
    AcademyRosterRequest,
    AcademySubmission,
    AcademyTeam,
)
from apps.accounts.models import Role
from apps.activity.models import ActivityLog
from apps.marketplace.models import (
    Brand,
    Contest,
    ContestEntry,
    Course,
    Enrollment,
    Job,
    JobApplication,
    Lesson,
    LessonProgress,
    Module,
    Prize,
    Product,
    SavedJob,
    Testimonial,
)

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_TYPE_MAP = {
    "talent": Role.TALENT,
    "employer": Role.EMPLOYER,
    "admin": Role.ADMIN,
    "student": Role.STUDENT,
    "facilitator": Role.FACILITATOR,
    "judge": Role.JUDGE,
}


def parse_json(value):
    """Raw cursor fetches of `jsonb` columns come back as the literal JSON
    text (Django's JSONField `from_db_value` conversion only kicks in
    through the ORM's query compiler, never for a plain
    `connection.cursor()` fetch) — every jsonb-sourced field must be
    parsed by hand before use."""
    import json

    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    return json.loads(value)


def normalize_string_list(value) -> list:
    """Port of src/lib/data.ts's normalizeStringList — defensive against
    Strapi's legacy rich-text "blocks" shape ever showing up in a
    string-list field. A no-op for this dataset (every sample checked
    during ETL development was already a plain string list), kept for
    safety since the ETL only gets one real run before cutover."""
    value = parse_json(value)
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict) and isinstance(item.get("children"), list):
            out.append("".join(c.get("text", "") for c in item["children"]))
        else:
            continue
    return [s for s in out if s]


class _DryRunRollback(Exception):
    pass


FAILED = object()  # distinguishes "row write failed" from "succeeded and returned None"


class Command(BaseCommand):
    help = "One-time copy of Strapi's existing data into the new Django-native tables."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Roll back all writes at the end.")

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.counts = {}

        try:
            with transaction.atomic():
                self.run()
                if self.dry_run:
                    raise _DryRunRollback()
        except _DryRunRollback:
            pass

        label = "DRY RUN (rolled back)" if self.dry_run else "COMMITTED"
        self.stdout.write(self.style.SUCCESS(f"\nETL complete — {label}"))
        for name, n in self.counts.items():
            self.stdout.write(f"  {name}: {n}")

    # ------------------------------------------------------------------
    def run(self):
        user_map = self.migrate_users()
        self.migrate_brands()
        self.migrate_testimonials()
        self.migrate_products()
        job_map = self.migrate_jobs()
        contest_map = self.migrate_contests()
        course_map = self.migrate_courses()

        self.migrate_job_applications(job_map, user_map)
        self.migrate_contest_entries(contest_map, user_map)
        self.migrate_enrollments(course_map, user_map)
        self.migrate_lesson_progress(course_map, user_map)
        self.migrate_saved_jobs(job_map, user_map)
        self.migrate_activity_log()

        category_map = self.migrate_academy_categories()
        academy_course_map = self.migrate_academy_courses(category_map)
        self.migrate_academy_materials(academy_course_map)

        cohort_map, enrollment_map = self.rebuild_academy_cohort_subtree(academy_course_map, user_map)
        submission_map = self.migrate_academy_submissions(enrollment_map)
        self.migrate_academy_judgments(submission_map, user_map)
        self.migrate_academy_teams(cohort_map, user_map)
        self.migrate_academy_live_sessions(cohort_map)
        self.migrate_academy_roster_requests(cohort_map, user_map)
        self.migrate_academy_certificates(enrollment_map)

    def _count(self, name, n):
        self.counts[name] = n
        self.stdout.write(f"  ... {name}: {n}")

    def _rows(self, sql, params=None):
        with connection.cursor() as cur:
            cur.execute(sql, params or [])
            columns = [c[0] for c in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]

    def _safe_row(self, description, fn):
        """Real Strapi data isn't guaranteed to satisfy every constraint
        Django's stricter schema adds (e.g. a CHECK on weeks >= 0 that
        Strapi never enforced) — one bad row must not abort the whole ETL.
        Postgres aborts the entire transaction on any statement error, so
        each row gets its own SAVEPOINT (nested `atomic()`); a failure
        rolls back only that row and is logged, not raised."""
        try:
            with transaction.atomic():
                return fn()
        except Exception as err:  # noqa: BLE001
            self.stdout.write(self.style.WARNING(f"  ... skipped {description}: {err}"))
            return FAILED

    # ------------------------------------------------------------------
    # Users
    def migrate_users(self) -> dict[int, int]:
        rows = self._rows(
            """
            SELECT u.id, u.username, u.email, u.password, u.name, u.whatsapp, u.confirmed, u.blocked,
                   u.created_at, u.updated_at, r.type AS role_type
            FROM up_users u
            LEFT JOIN up_users_role_lnk l ON l.user_id = u.id
            LEFT JOIN up_roles r ON r.id = l.role_id
            """
        )
        user_map = {}
        skipped = 0
        for row in rows:
            role = ROLE_TYPE_MAP.get(row["role_type"])
            if not row["email"] or not role:
                # Orphaned/incomplete rows (no email) or Strapi's system
                # "authenticated"/"public" default roles — neither maps to
                # a real domain account.
                skipped += 1
                continue

            def _write(row=row):
                user, _ = User.objects.update_or_create(
                    email=row["email"].lower(),
                    defaults={
                        "username": row["username"] or row["email"],
                        "name": row["name"] or "",
                        "whatsapp": row["whatsapp"] or "",
                        "role": role,
                        "confirmed": bool(row["confirmed"]),
                        "blocked": bool(row["blocked"]),
                        # Raw bcrypt hash from Strapi's bcryptjs, re-encoded
                        # for Django's plain BCryptPasswordHasher (no
                        # SHA256 pre-hash) — see PASSWORD_HASHERS in
                        # settings/base.py. Falls back to an unusable hash
                        # if Strapi's row somehow had none, rather than
                        # leaving the column blank.
                        "password": f"bcrypt${row['password']}" if row["password"] else "!",
                    },
                )
                User.objects.filter(pk=user.pk).update(created_at=row["created_at"], updated_at=row["updated_at"])
                return user.pk

            pk = self._safe_row(f"user {row['email']}", _write)
            if pk is not FAILED:
                user_map[row["id"]] = pk

        self._count("users", len(user_map))
        if skipped:
            self.stdout.write(self.style.WARNING(f"  ... users skipped (no email / system role): {skipped}"))
        return user_map

    # ------------------------------------------------------------------
    # Marketplace catalog (no natural key, no dependents -> wipe + recreate)
    def migrate_brands(self):
        Brand.objects.all().delete()
        rows = self._rows("SELECT * FROM brands")
        n = 0
        for row in rows:
            ok = self._safe_row(
                f"brand {row['name']!r}",
                lambda row=row: Brand.objects.create(
                    name=row["name"], kind=row["kind"], industry=row["industry"], tagline=row["tagline"],
                    url=row["url"], featured=bool(row["featured"]), seed=row["seed"] or "",
                ),
            )
            n += ok is not FAILED
        self._count("brands", n)

    def migrate_testimonials(self):
        Testimonial.objects.all().delete()
        rows = self._rows("SELECT * FROM testimonials")
        n = 0
        for row in rows:
            ok = self._safe_row(
                f"testimonial {row['name']!r}",
                lambda row=row: Testimonial.objects.create(quote=row["quote"], name=row["name"], role=row["role"]),
            )
            n += ok is not FAILED
        self._count("testimonials", n)

    def migrate_products(self):
        rows = self._rows("SELECT * FROM products")
        n = 0
        for row in rows:
            ok = self._safe_row(
                f"product {row['slug']!r}",
                lambda row=row: Product.objects.update_or_create(
                    slug=row["slug"],
                    defaults={
                        "name": row["name"], "category": row["category"], "type": row["type"], "price": row["price"],
                        "blurb": row["blurb"], "details": normalize_string_list(row["details"]),
                        "sizes": normalize_string_list(row["sizes"]), "maker": row["maker"] or "",
                        "condition": row["condition"], "brand": row["brand"] or "", "shopify_url": row["shopify_url"],
                        "seed": row["seed"] or "",
                    },
                ),
            )
            n += ok is not FAILED
        self._count("products", n)

    # ------------------------------------------------------------------
    def migrate_jobs(self) -> dict[int, int]:
        rows = self._rows("SELECT * FROM jobs")
        job_map = {}
        for row in rows:
            def _write(row=row):
                job, _ = Job.objects.update_or_create(
                    slug=row["slug"],
                    defaults={
                        "title": row["title"], "org": row["org"], "org_kind": row["org_kind"], "field": row["field"],
                        "location": row["location"], "location_type": row["location_type"], "type": row["type"],
                        "level": row["level"], "pay": row["pay"], "summary": row["summary"],
                        "responsibilities": normalize_string_list(row["responsibilities"]),
                        "requirements": normalize_string_list(row["requirements"]), "status": row["status"],
                    },
                )
                Job.objects.filter(pk=job.pk).update(created_at=row["created_at"], updated_at=row["updated_at"])
                return job.pk

            pk = self._safe_row(f"job {row['slug']!r}", _write)
            if pk is not FAILED:
                job_map[row["id"]] = pk
        self._count("jobs", len(job_map))
        return job_map

    def migrate_contests(self) -> dict[int, int]:
        rows = self._rows("SELECT * FROM contests")
        prize_rows = self._rows(
            """
            SELECT c.entity_id AS contest_id, p.place, p.label, p.amount
            FROM contests_cmps c JOIN components_contest_prizes p ON p.id = c.cmp_id
            WHERE c.component_type = 'contest.prize' ORDER BY c.entity_id, c."order"
            """
        )
        prizes_by_contest = {}
        for pr in prize_rows:
            prizes_by_contest.setdefault(pr["contest_id"], []).append(pr)

        contest_map = {}
        prize_count = 0
        for row in rows:
            def _write(row=row):
                contest, _ = Contest.objects.update_or_create(
                    slug=row["slug"],
                    defaults={
                        "title": row["title"], "field": row["field"], "brief": row["brief"],
                        "rules": normalize_string_list(row["rules"]), "deadline": row["deadline"],
                        "status": row["status"], "entries": row["entries"] or 0, "seed": row["seed"] or "",
                    },
                )
                Contest.objects.filter(pk=contest.pk).update(created_at=row["created_at"], updated_at=row["updated_at"])

                Prize.objects.filter(contest=contest).delete()
                created = 0
                for pr in prizes_by_contest.get(row["id"], []):
                    Prize.objects.create(contest=contest, place=pr["place"], label=pr["label"], amount=pr["amount"])
                    created += 1
                return contest.pk, created

            result = self._safe_row(f"contest {row['slug']!r}", _write)
            if result is not FAILED:
                pk, created = result
                contest_map[row["id"]] = pk
                prize_count += created

        self._count("contests", len(contest_map))
        self._count("prizes", prize_count)
        return contest_map

    def migrate_courses(self) -> dict[int, int]:
        rows = self._rows("SELECT * FROM courses")
        module_rows = self._rows(
            """
            SELECT c.entity_id AS course_id, c."order" AS module_order, m.id AS module_id, m.title
            FROM courses_cmps c JOIN components_course_modules m ON m.id = c.cmp_id
            WHERE c.component_type = 'course.module' ORDER BY c.entity_id, c."order"
            """
        )
        lesson_rows = self._rows(
            """
            SELECT mc.entity_id AS module_id, mc."order" AS lesson_order, l.key, l.title, l.duration, l.free
            FROM components_course_modules_cmps mc JOIN components_course_lessons l ON l.id = mc.cmp_id
            WHERE mc.component_type = 'course.lesson' ORDER BY mc.entity_id, mc."order"
            """
        )
        lessons_by_module = {}
        for lr in lesson_rows:
            lessons_by_module.setdefault(lr["module_id"], []).append(lr)
        modules_by_course = {}
        for mr in module_rows:
            modules_by_course.setdefault(mr["course_id"], []).append(mr)

        course_map = {}
        lesson_count = 0
        for row in rows:
            def _write(row=row):
                course, _ = Course.objects.update_or_create(
                    slug=row["slug"],
                    defaults={
                        "title": row["title"], "field": row["field"], "level": row["level"], "kind": row["kind"],
                        "delivery": row["delivery"], "location": row["location"] or "", "instructor": row["instructor"],
                        "instructor_role": row["instructor_role"], "price": row["price"], "weeks": row["weeks"],
                        "blurb": row["blurb"], "outcomes": normalize_string_list(row["outcomes"]),
                        "seed": row["seed"] or "",
                    },
                )
                Course.objects.filter(pk=course.pk).update(created_at=row["created_at"], updated_at=row["updated_at"])

                Module.objects.filter(course=course).delete()  # cascades to Lesson too
                created_lessons = 0
                for order, mr in enumerate(modules_by_course.get(row["id"], []), start=1):
                    module = Module.objects.create(course=course, title=mr["title"], order=order)
                    for lesson_order, lr in enumerate(lessons_by_module.get(mr["module_id"], []), start=1):
                        Lesson.objects.create(
                            module=module, key=lr["key"], title=lr["title"], duration=lr["duration"],
                            free=bool(lr["free"]), order=lesson_order,
                        )
                        created_lessons += 1
                return course.pk, created_lessons

            result = self._safe_row(f"course {row['slug']!r}", _write)
            if result is not FAILED:
                pk, created_lessons = result
                course_map[row["id"]] = pk
                lesson_count += created_lessons

        self._count("courses", len(course_map))
        self._count("modules", len(module_rows))
        self._count("lessons", lesson_count)
        return course_map

    # ------------------------------------------------------------------
    # Ownership relations (Stage 3's five unique_together pairs)
    def migrate_job_applications(self, job_map, user_map):
        rows = self._rows(
            """
            SELECT a.*, jl.job_id, ul.user_id FROM job_applications a
            LEFT JOIN job_applications_job_lnk jl ON jl.job_application_id = a.id
            LEFT JOIN job_applications_user_lnk ul ON ul.job_application_id = a.id
            """
        )
        n = 0
        for row in rows:
            job_pk, user_pk = job_map.get(row["job_id"]), user_map.get(row["user_id"])
            if not job_pk or not user_pk:
                continue

            def _write(row=row, job_pk=job_pk, user_pk=user_pk):
                obj, _ = JobApplication.objects.update_or_create(
                    job_id=job_pk, user_id=user_pk,
                    defaults={
                        "name": row["name"], "whatsapp": row["whatsapp"], "message": row["message"] or "",
                        "portfolio_url": row["portfolio_url"] or "", "video_url": row["video_url"] or "",
                        "status": row["status"],
                    },
                )
                JobApplication.objects.filter(pk=obj.pk).update(created_at=row["created_at"], updated_at=row["updated_at"])

            n += self._safe_row(f"job_application {row['id']}", _write) is not FAILED
        self._count("job_applications", n)

    def migrate_contest_entries(self, contest_map, user_map):
        rows = self._rows(
            """
            SELECT e.*, cl.contest_id, ul.user_id FROM contest_entries e
            LEFT JOIN contest_entries_contest_lnk cl ON cl.contest_entry_id = e.id
            LEFT JOIN contest_entries_user_lnk ul ON ul.contest_entry_id = e.id
            """
        )
        n = 0
        for row in rows:
            contest_pk, user_pk = contest_map.get(row["contest_id"]), user_map.get(row["user_id"])
            if not contest_pk or not user_pk:
                continue

            def _write(row=row, contest_pk=contest_pk, user_pk=user_pk):
                obj, _ = ContestEntry.objects.update_or_create(
                    contest_id=contest_pk, user_id=user_pk,
                    defaults={
                        "name": row["name"], "whatsapp": row["whatsapp"], "description": row["description"],
                        "status": row["status"], "rank": row["rank"],
                    },
                )
                ContestEntry.objects.filter(pk=obj.pk).update(created_at=row["created_at"], updated_at=row["updated_at"])

            n += self._safe_row(f"contest_entry {row['id']}", _write) is not FAILED
        self._count("contest_entries", n)

    def migrate_enrollments(self, course_map, user_map):
        rows = self._rows(
            """
            SELECT e.*, cl.course_id, ul.user_id FROM enrollments e
            LEFT JOIN enrollments_course_lnk cl ON cl.enrollment_id = e.id
            LEFT JOIN enrollments_user_lnk ul ON ul.enrollment_id = e.id
            """
        )
        n = 0
        for row in rows:
            course_pk, user_pk = course_map.get(row["course_id"]), user_map.get(row["user_id"])
            if not course_pk or not user_pk:
                continue

            def _write(row=row, course_pk=course_pk, user_pk=user_pk):
                obj, _ = Enrollment.objects.update_or_create(
                    course_id=course_pk, user_id=user_pk,
                    defaults={"name": row["name"], "whatsapp": row["whatsapp"], "message": row["message"] or ""},
                )
                Enrollment.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            n += self._safe_row(f"enrollment {row['id']}", _write) is not FAILED
        self._count("enrollments", n)

    def migrate_lesson_progress(self, course_map, user_map):
        rows = self._rows(
            """
            SELECT p.*, cl.course_id, ul.user_id FROM lesson_progresses p
            LEFT JOIN lesson_progresses_course_lnk cl ON cl.lesson_progress_id = p.id
            LEFT JOIN lesson_progresses_user_lnk ul ON ul.lesson_progress_id = p.id
            """
        )
        n = 0
        for row in rows:
            course_pk, user_pk = course_map.get(row["course_id"]), user_map.get(row["user_id"])
            if not course_pk or not user_pk:
                continue

            def _write(row=row, course_pk=course_pk, user_pk=user_pk):
                LessonProgress.objects.update_or_create(
                    course_id=course_pk, user_id=user_pk, lesson_key=row["lesson_key"],
                    defaults={"completed_at": row["completed_at"]},
                )

            n += self._safe_row(f"lesson_progress {row['id']}", _write) is not FAILED
        self._count("lesson_progress", n)

    def migrate_saved_jobs(self, job_map, user_map):
        rows = self._rows(
            """
            SELECT s.*, jl.job_id, ul.user_id FROM saved_jobs s
            LEFT JOIN saved_jobs_job_lnk jl ON jl.saved_job_id = s.id
            LEFT JOIN saved_jobs_user_lnk ul ON ul.saved_job_id = s.id
            """
        )
        n = 0
        for row in rows:
            job_pk, user_pk = job_map.get(row["job_id"]), user_map.get(row["user_id"])
            if not job_pk or not user_pk:
                continue

            def _write(row=row, job_pk=job_pk, user_pk=user_pk):
                obj, _ = SavedJob.objects.update_or_create(job_id=job_pk, user_id=user_pk)
                SavedJob.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            n += self._safe_row(f"saved_job {row['id']}", _write) is not FAILED
        self._count("saved_jobs", n)

    def migrate_activity_log(self):
        rows = self._rows("SELECT * FROM activity_logs ORDER BY id")
        n = 0
        for row in rows:
            def _write(row=row):
                ActivityLog.objects.update_or_create(
                    who=row["who"], what=row["what"], kind=row["kind"], occurred_at=row["occurred_at"],
                )

            n += self._safe_row(f"activity_log {row['id']}", _write) is not FAILED
        self._count("activity_log", n)

    # ------------------------------------------------------------------
    # Academy catalog (persists across runs — outside the cohort subtree)
    def migrate_academy_categories(self) -> dict[int, int]:
        rows = self._rows("SELECT * FROM academy_categories")
        category_map = {}
        for row in rows:
            def _write(row=row):
                cat, _ = AcademyCategory.objects.update_or_create(
                    slug=row["slug"], defaults={"name": row["name"], "blurb": row["blurb"] or ""},
                )
                return cat.pk

            pk = self._safe_row(f"academy_category {row['slug']!r}", _write)
            if pk is not FAILED:
                category_map[row["id"]] = pk
        self._count("academy_categories", len(category_map))
        return category_map

    def migrate_academy_courses(self, category_map) -> dict[int, int]:
        rows = self._rows(
            """
            SELECT c.*, l.academy_category_id FROM academy_courses c
            LEFT JOIN academy_courses_category_lnk l ON l.academy_course_id = c.id
            """
        )
        course_map = {}
        for row in rows:
            category_pk = category_map.get(row["academy_category_id"])
            if not category_pk:
                continue

            def _write(row=row, category_pk=category_pk):
                course, _ = AcademyCourse.objects.update_or_create(
                    slug=row["slug"],
                    defaults={
                        "title": row["title"], "category_id": category_pk, "months": row["months"],
                        "certificate": bool(row["certificate"]), "weeks_total": row["weeks_total"],
                        "days_total": row["days_total"],
                    },
                )
                return course.pk

            pk = self._safe_row(f"academy_course {row['slug']!r}", _write)
            if pk is not FAILED:
                course_map[row["id"]] = pk
        self._count("academy_courses", len(course_map))
        return course_map

    def migrate_academy_materials(self, academy_course_map):
        rows = self._rows(
            """
            SELECT m.*, l.academy_course_id FROM academy_materials m
            LEFT JOIN academy_materials_course_lnk l ON l.academy_material_id = m.id
            """
        )
        n = 0
        for row in rows:
            course_pk = academy_course_map.get(row["academy_course_id"])
            if not course_pk:
                continue

            def _write(row=row, course_pk=course_pk):
                AcademyMaterial.objects.update_or_create(
                    course_id=course_pk, day=row["day"],
                    defaults={
                        "text": row["text"] or "", "external_video_url": row["external_video_url"] or "",
                        "mux_upload_id": row["mux_upload_id"] or "", "mux_asset_id": row["mux_asset_id"] or "",
                        "mux_playback_id": row["mux_playback_id"] or "", "task": row["task"] or "",
                        "task_detail": row["task_detail"] or "", "docs": parse_json(row["docs"]) or [],
                    },
                )

            n += self._safe_row(f"academy_material course={course_pk} day={row['day']}", _write) is not FAILED
        self._count("academy_materials", n)

    # ------------------------------------------------------------------
    # Academy cohort-rooted subtree — no natural key on Cohort itself, so
    # the whole subtree is wiped and rebuilt from source every run.
    def rebuild_academy_cohort_subtree(self, academy_course_map, user_map):
        AcademyCohort.objects.all().delete()  # cascades Enrollment/Submission/Judgment/Team/Session/RosterRequest/Certificate

        cohort_rows = self._rows(
            """
            SELECT c.*, cl.academy_course_id, fl.user_id AS facilitator_id FROM academy_cohorts c
            LEFT JOIN academy_cohorts_course_lnk cl ON cl.academy_cohort_id = c.id
            LEFT JOIN academy_cohorts_facilitator_lnk fl ON fl.academy_cohort_id = c.id
            """
        )
        cohort_map = {}
        for row in cohort_rows:
            course_pk = academy_course_map.get(row["academy_course_id"])
            facilitator_pk = user_map.get(row["facilitator_id"])
            if not course_pk or not facilitator_pk:
                continue

            def _write(row=row, course_pk=course_pk, facilitator_pk=facilitator_pk):
                cohort = AcademyCohort.objects.create(
                    name=row["name"], course_id=course_pk, facilitator_id=facilitator_pk,
                    weeks_total=row["weeks_total"], days_total=row["days_total"], start_date=row["start_date"],
                    status=row["status"], released_week=row["released_week"], min_completion=row["min_completion"],
                    check_weeks=parse_json(row["check_weeks"]) or [],
                )
                return cohort.pk

            pk = self._safe_row(f"academy_cohort {row['name']!r}", _write)
            if pk is not FAILED:
                cohort_map[row["id"]] = pk
        self._count("academy_cohorts", len(cohort_map))

        enrollment_rows = self._rows(
            """
            SELECT e.*, cl.academy_cohort_id, ul.user_id FROM academy_enrollments e
            LEFT JOIN academy_enrollments_cohort_lnk cl ON cl.academy_enrollment_id = e.id
            LEFT JOIN academy_enrollments_user_lnk ul ON ul.academy_enrollment_id = e.id
            """
        )
        enrollment_map = {}
        for row in enrollment_rows:
            cohort_pk = cohort_map.get(row["academy_cohort_id"])
            user_pk = user_map.get(row["user_id"])
            if not cohort_pk or not user_pk:
                continue

            def _write(row=row, cohort_pk=cohort_pk, user_pk=user_pk):
                enrollment, _ = AcademyEnrollment.objects.update_or_create(
                    cohort_id=cohort_pk, user_id=user_pk,
                    defaults={
                        "status": row["status"], "current_day": row["current_day"],
                        "submitted_days": parse_json(row["submitted_days"]) or [],
                        "early_access_requested": bool(row["early_access_requested"]),
                        "early_weeks": parse_json(row["early_weeks"]) or [], "removed": bool(row["removed"]),
                        "shortlisted": bool(row["shortlisted"]),
                    },
                )
                return enrollment.pk

            pk = self._safe_row(f"academy_enrollment {row['id']}", _write)
            if pk is not FAILED:
                enrollment_map[row["id"]] = pk
        self._count("academy_enrollments", len(enrollment_map))

        return cohort_map, enrollment_map

    def migrate_academy_submissions(self, enrollment_map) -> dict[int, int]:
        rows = self._rows(
            """
            SELECT s.*, l.academy_enrollment_id FROM academy_submissions s
            LEFT JOIN academy_submissions_enrollment_lnk l ON l.academy_submission_id = s.id
            """
        )
        submission_map = {}
        for row in rows:
            enrollment_pk = enrollment_map.get(row["academy_enrollment_id"])
            if not enrollment_pk:
                continue

            def _write(row=row, enrollment_pk=enrollment_pk):
                submission, _ = AcademySubmission.objects.update_or_create(
                    anon_handle=row["anon_handle"],
                    defaults={
                        "enrollment_id": enrollment_pk, "day": row["day"], "week": row["week"], "task": row["task"],
                        "course_title": row["course_title"], "url": row["url"], "note": row["note"] or "",
                        "submitted_at": row["submitted_at"], "rated": bool(row["rated"]),
                    },
                )
                return submission.pk

            pk = self._safe_row(f"academy_submission {row['anon_handle']!r}", _write)
            if pk is not FAILED:
                submission_map[row["id"]] = pk
        self._count("academy_submissions", len(submission_map))
        return submission_map

    def migrate_academy_judgments(self, submission_map, user_map):
        rows = self._rows(
            """
            SELECT j.*, sl.academy_submission_id, jl.user_id AS judge_id FROM academy_judgments j
            LEFT JOIN academy_judgments_submission_lnk sl ON sl.academy_judgment_id = j.id
            LEFT JOIN academy_judgments_judge_lnk jl ON jl.academy_judgment_id = j.id
            """
        )
        n = 0
        for row in rows:
            submission_pk = submission_map.get(row["academy_submission_id"])
            judge_pk = user_map.get(row["judge_id"])
            if not submission_pk or not judge_pk:
                continue

            def _write(row=row, submission_pk=submission_pk, judge_pk=judge_pk):
                AcademyJudgment.objects.update_or_create(
                    submission_id=submission_pk, judge_id=judge_pk,
                    defaults={
                        "brief": row["brief"], "craft": row["craft"], "originality": row["originality"],
                        "average": row["average"], "feedback": row["feedback"],
                    },
                )

            n += self._safe_row(f"academy_judgment {row['id']}", _write) is not FAILED
        self._count("academy_judgments", n)

    def migrate_academy_teams(self, cohort_map, user_map):
        rows = self._rows(
            """
            SELECT t.*, cl.academy_cohort_id FROM academy_teams t
            LEFT JOIN academy_teams_cohort_lnk cl ON cl.academy_team_id = t.id
            """
        )
        member_rows = self._rows("SELECT academy_team_id, user_id FROM academy_teams_members_lnk")
        members_by_team = {}
        for mr in member_rows:
            members_by_team.setdefault(mr["academy_team_id"], []).append(mr["user_id"])

        n = 0
        for row in rows:
            cohort_pk = cohort_map.get(row["academy_cohort_id"])
            if not cohort_pk:
                continue

            def _write(row=row, cohort_pk=cohort_pk):
                team = AcademyTeam.objects.create(cohort_id=cohort_pk, week=row["week"], title=row["title"])
                member_pks = [user_map[uid] for uid in members_by_team.get(row["id"], []) if uid in user_map]
                team.members.set(member_pks)

            n += self._safe_row(f"academy_team {row['title']!r}", _write) is not FAILED
        self._count("academy_teams", n)

    def migrate_academy_live_sessions(self, cohort_map):
        rows = self._rows(
            """
            SELECT s.*, cl.academy_cohort_id FROM academy_live_sessions s
            LEFT JOIN academy_live_sessions_cohort_lnk cl ON cl.academy_live_session_id = s.id
            """
        )
        n = 0
        for row in rows:
            cohort_pk = cohort_map.get(row["academy_cohort_id"])
            if not cohort_pk:
                continue

            def _write(row=row, cohort_pk=cohort_pk):
                AcademyLiveSession.objects.create(
                    cohort_id=cohort_pk, title=row["title"], type=row["type"], day=row["day"], time=row["time"],
                    host=row["host"], link=row["link"] or "",
                )

            n += self._safe_row(f"academy_live_session {row['title']!r}", _write) is not FAILED
        self._count("academy_live_sessions", n)

    def migrate_academy_roster_requests(self, cohort_map, user_map):
        rows = self._rows(
            """
            SELECT r.*, cl.academy_cohort_id, fl.user_id AS facilitator_id FROM academy_roster_requests r
            LEFT JOIN academy_roster_requests_cohort_lnk cl ON cl.academy_roster_request_id = r.id
            LEFT JOIN academy_roster_requests_facilitator_lnk fl ON fl.academy_roster_request_id = r.id
            """
        )
        n = 0
        for row in rows:
            cohort_pk = cohort_map.get(row["academy_cohort_id"])
            facilitator_pk = user_map.get(row["facilitator_id"])
            if not cohort_pk or not facilitator_pk:
                continue

            def _write(row=row, cohort_pk=cohort_pk, facilitator_pk=facilitator_pk):
                obj = AcademyRosterRequest.objects.create(
                    cohort_id=cohort_pk, facilitator_id=facilitator_pk, count=row["count"], note=row["note"] or "",
                    status=row["status"],
                )
                AcademyRosterRequest.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            n += self._safe_row(f"academy_roster_request {row['id']}", _write) is not FAILED
        self._count("academy_roster_requests", n)

    def migrate_academy_certificates(self, enrollment_map):
        rows = self._rows(
            """
            SELECT c.*, l.academy_enrollment_id FROM academy_certificates c
            LEFT JOIN academy_certificates_enrollment_lnk l ON l.academy_certificate_id = c.id
            """
        )
        n = 0
        for row in rows:
            enrollment_pk = enrollment_map.get(row["academy_enrollment_id"])
            if not enrollment_pk:
                continue

            def _write(row=row, enrollment_pk=enrollment_pk):
                AcademyCertificate.objects.update_or_create(
                    enrollment_id=enrollment_pk,
                    defaults={
                        "verification_code": row["verification_code"], "issued_at": row["issued_at"],
                        "student_name_snapshot": row["student_name_snapshot"],
                        "course_title_snapshot": row["course_title_snapshot"],
                        "cohort_name_snapshot": row["cohort_name_snapshot"], "pdf_url": row["pdf_url"] or "",
                    },
                )

            n += self._safe_row(f"academy_certificate {row['id']}", _write) is not FAILED
        self._count("academy_certificates", n)
