from django.db.models import Avg
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AcademyUser, Role
from apps.accounts.permissions import IsAdminRole
from apps.activity.models import ActivityLog
from apps.core.cache import cached

from .models import (
    APPLICATION_STATUS_CHOICES,
    AcademyApplication,
    AcademyCategory,
    AcademyCohort,
    AcademyCourse,
    AcademyEnrollment,
    AcademyJudgment,
    AcademyRosterRequest,
)
from .roster_request import shape_roster_request
from .serializers import AcademyAdminApplicationSerializer
from .services import with_waitlist_positions

ACADEMY_KINDS = ["rollout", "early-access", "gate-action", "judgment", "team-match", "certificate-issued", "application"]
# Admin is excluded here on purpose: Admin accounts live in the separate
# accounts.User table, not AcademyUser, so this admin tooling — which now
# reads/writes AcademyUser exclusively — can only ever search/promote
# within student/facilitator/judge. "Promoting" someone to Admin isn't a
# role-field edit anymore, it's a different table entirely.
ACADEMY_ROLES = [Role.STUDENT, Role.FACILITATOR, Role.JUDGE]


class AcademyAdminOverviewView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        def build():
            return [
                {"label": "Categories", "value": str(AcademyCategory.objects.count())},
                {"label": "Courses", "value": str(AcademyCourse.objects.count())},
                {"label": "Active cohorts", "value": str(AcademyCohort.objects.count())},
                {"label": "Students enrolled", "value": str(AcademyEnrollment.objects.filter(removed=False).count())},
            ]

        return Response({"data": cached("academy-admin:overview", "v1", 90, build)})


class AcademyAdminTopRatedView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        # GROUP BY in the database instead of loading every judgment row
        # (plus its submission/enrollment/user join) into Python — this view
        # previously scaled linearly with total judgments ever recorded.
        rows = [
            {
                "userId": r["submission__enrollment__user_id"],
                "name": r["submission__enrollment__user__name"] or r["submission__enrollment__user__username"],
                "avgScore": round(float(r["avg"]) * 10) / 10,
            }
            for r in AcademyJudgment.objects.values(
                "submission__enrollment__user_id",
                "submission__enrollment__user__name",
                "submission__enrollment__user__username",
            )
            .annotate(avg=Avg("average"))
            .order_by("-avg")[:10]
        ]
        return Response({"data": rows})


class AcademyAdminActivityView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        rows = ActivityLog.objects.filter(kind__in=ACADEMY_KINDS).order_by("-occurred_at")[:10]
        return Response({"data": [{"who": r.who, "what": r.what, "when": r.occurred_at} for r in rows]})


class AcademyAdminUsersView(APIView):
    """Name-searchable picker backing admin forms (assign a facilitator to a
    cohort, enroll a student, change a role) — replaces raw "type a user ID"
    inputs. `role` is optional: omit it to search across all 3 Academy
    roles at once. Operates on the separate AcademyUser table, not the
    main accounts.User."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        role = request.query_params.get("role")
        search = request.query_params.get("search")
        if role and role.lower() not in ACADEMY_ROLES:
            raise ValidationError(f"role must be one of: {', '.join(r.label for r in ACADEMY_ROLES)}")

        qs = AcademyUser.objects.filter(role__in=([role.lower()] if role else ACADEMY_ROLES))
        if search:
            qs = qs.filter(name__icontains=search)
        qs = qs.order_by("name")

        return Response(
            {
                "data": [
                    {
                        "id": u.id,
                        "name": u.name or u.username,
                        "email": u.email,
                        "whatsapp": u.whatsapp,
                        "role": Role(u.role).label,
                    }
                    for u in qs
                ]
            }
        )

    def post(self, request):
        """Always lands the new account as Student — promotion to
        Facilitator/Judge is a deliberate separate step
        (AcademyAdminUserRoleView below), never implicit."""
        name = request.data.get("name")
        email = request.data.get("email")
        username = request.data.get("username")
        password = request.data.get("password")
        if not all([name, email, username, password]):
            raise ValidationError("name, email, username and password are required.")

        email = email.lower()
        if AcademyUser.objects.filter(email=email).exists():
            raise ValidationError("Email already in use.")
        if AcademyUser.objects.filter(username=username).exists():
            raise ValidationError("Username already in use.")

        user = AcademyUser.objects.create_user(
            email=email,
            password=password,
            username=username,
            name=name,
            role=Role.STUDENT,
            confirmed=True,
            blocked=False,
        )
        return Response({"data": {"id": user.id, "name": user.name, "email": user.email, "username": user.username, "role": "Student"}})


class AcademyAdminUserRoleView(APIView):
    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        role = request.data.get("role")
        if not role or role.lower() not in ACADEMY_ROLES:
            raise ValidationError(f"role is required and must be one of: {', '.join(r.label for r in ACADEMY_ROLES)}")

        user = AcademyUser.objects.filter(pk=pk).first()
        if not user:
            raise NotFound("User not found.")

        user.role = role.lower()
        user.save(update_fields=["role"])
        return Response({"data": {"id": user.id, "name": user.name or user.username, "email": user.email, "role": Role(user.role).label}})


class AcademyAdminRosterRequestsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        requests = (
            AcademyRosterRequest.objects.select_related("cohort__course", "facilitator").order_by("-created_at")
        )
        return Response({"data": [shape_roster_request(r) for r in requests]})


class AcademyAdminApplicationsView(APIView):
    """GET /academy-admin/applications?status=Waitlisted — ops visibility
    across every course's waitlist."""

    permission_classes = [IsAdminRole]
    APPLICATION_STATUSES = dict(APPLICATION_STATUS_CHOICES)

    def get(self, request):
        status_param = request.query_params.get("status")
        qs = AcademyApplication.objects.select_related("user", "course").order_by("-created_at")
        if status_param:
            if status_param not in self.APPLICATION_STATUSES:
                raise ValidationError(f"status must be one of: {', '.join(self.APPLICATION_STATUSES)}")
            qs = qs.filter(status=status_param)
        qs = with_waitlist_positions(qs)

        data = [
            {
                "id": a.id,
                "status": a.status,
                "position": a.waitlist_position if a.status == "Waitlisted" else None,
                "user": {"id": a.user.id, "name": a.user.name or a.user.username, "email": a.user.email},
                "course": {"id": a.course.id, "title": a.course.title},
                "createdAt": a.created_at,
            }
            for a in qs
        ]
        return Response({"data": AcademyAdminApplicationSerializer(data, many=True).data})
