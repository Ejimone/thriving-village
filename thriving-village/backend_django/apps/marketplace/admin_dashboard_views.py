"""Ported from backend/src/api/admin-dashboard/controllers/admin-dashboard.ts."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.http import HttpResponseForbidden
from django.utils import timezone
from django.views import View
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import CachedJWTAuthentication
from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminRole
from apps.activity.models import ActivityLog
from apps.core.cache import cached
from apps.core.sse import sse_response, sse_stream
from apps.integrations.pubsub import subscribe

from .models import Contest, Enrollment, JobApplication

User = get_user_model()


class AdminDashboardStatsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        def build():
            week_ago = timezone.now() - timedelta(days=7)
            users = User.objects.count()
            users_last_week = User.objects.filter(created_at__gte=week_ago).count()
            applications = JobApplication.objects.count()
            applications_last_week = JobApplication.objects.filter(created_at__gte=week_ago).count()
            enrollments = Enrollment.objects.count()
            contests_live = Contest.objects.filter(status="live").count()

            return [
                {"label": "Total users", "value": str(users), "delta": f"+{users_last_week} this week"},
                {"label": "Applications", "value": str(applications), "delta": f"+{applications_last_week} this week"},
                {"label": "Enrollments", "value": str(enrollments), "delta": ""},
                {"label": "Active contests", "value": str(contests_live), "delta": ""},
            ]

        data = cached("admin-dashboard:stats", "v1", 90, build)
        return Response({"data": data})


class AdminDashboardActivityView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        rows = ActivityLog.objects.order_by("-occurred_at")[:6]
        return Response({"data": [{"who": r.who, "what": r.what, "when": r.occurred_at} for r in rows]})


class AdminDashboardStreamView(View):
    """GET /api/admin-dashboard/stream — SSE stream of new activity, port
    of admin-dashboard.ts's `stream` action. Gated to Admin same as stats/
    activity above, but as a plain Django View (not DRF — see
    apps/core/sse.py's docstring), so the permission check has to happen by
    hand: simplejwt's authenticator only needs `request.META`, which a
    plain Django HttpRequest has too, so CachedJWTAuthentication can be
    reused as-is rather than duplicating token-parsing logic."""

    def get(self, request):
        try:
            result = CachedJWTAuthentication().authenticate(request)
        except Exception:  # noqa: BLE001
            result = None
        if not result or result[0].role != Role.ADMIN:
            return HttpResponseForbidden()

        return sse_response(sse_stream(subscribe("tv:activity"), "activity"))
