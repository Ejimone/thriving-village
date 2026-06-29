"""Port of backend/src/api/academy-admin/controllers/academy-admin.ts. The
`stream` SSE action doesn't exist on this controller (it lives on
admin-dashboard, deferred to Stage 12) — everything here is plain
request/response.
"""

from django.contrib.auth import get_user_model
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminRole
from apps.activity.models import ActivityLog
from apps.core.cache import cached

from .models import AcademyCategory, AcademyCohort, AcademyCourse, AcademyEnrollment, AcademyJudgment, AcademyRosterRequest
from .roster_request import shape_roster_request

User = get_user_model()

ACADEMY_KINDS = ["rollout", "early-access", "gate-action", "judgment", "team-match", "certificate-issued"]
ACADEMY_ROLES = [Role.STUDENT, Role.FACILITATOR, Role.JUDGE, Role.ADMIN]


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
        judgments = AcademyJudgment.objects.select_related("submission__enrollment__user")

        by_user = {}
        for j in judgments:
            user = j.submission.enrollment.user if j.submission and j.submission.enrollment else None
            if not user:
                continue
            entry = by_user.setdefault(user.id, {"name": user.name or user.username, "total": 0, "count": 0})
            entry["total"] += float(j.average)
            entry["count"] += 1

        rows = sorted(
            (
                {"userId": user_id, "name": e["name"], "avgScore": round((e["total"] / e["count"]) * 10) / 10}
                for user_id, e in by_user.items()
            ),
            key=lambda r: r["avgScore"],
            reverse=True,
        )[:10]
        return Response({"data": rows})


class AcademyAdminActivityView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        rows = ActivityLog.objects.filter(kind__in=ACADEMY_KINDS).order_by("-occurred_at")[:10]
        return Response({"data": [{"who": r.who, "what": r.what, "when": r.occurred_at} for r in rows]})


class AcademyAdminUsersView(APIView):
    """Name-searchable picker backing admin forms (assign a facilitator to a
    cohort, enroll a student, change a role) — replaces raw "type a user ID"
    inputs. `role` is optional: omit it to search across all 4 Academy roles
    at once (deliberately excludes Talent/Employer — this is an Academy
    tool)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        role = request.query_params.get("role")
        search = request.query_params.get("search")
        if role and role.lower() not in ACADEMY_ROLES:
            raise ValidationError(f"role must be one of: {', '.join(r.label for r in ACADEMY_ROLES)}")

        qs = User.objects.filter(role__in=([role.lower()] if role else ACADEMY_ROLES))
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
        Facilitator/Judge/Admin is a deliberate separate step
        (AcademyAdminUserRoleView below), never implicit."""
        name = request.data.get("name")
        email = request.data.get("email")
        username = request.data.get("username")
        password = request.data.get("password")
        if not all([name, email, username, password]):
            raise ValidationError("name, email, username and password are required.")

        email = email.lower()
        if User.objects.filter(email=email).exists():
            raise ValidationError("Email already in use.")
        if User.objects.filter(username=username).exists():
            raise ValidationError("Username already in use.")

        user = User.objects.create_user(
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

        user = User.objects.filter(pk=pk).first()
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
