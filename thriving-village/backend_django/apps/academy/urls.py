from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_dashboard_views import (
    AcademyAdminActivityView,
    AcademyAdminApplicationsView,
    AcademyAdminOverviewView,
    AcademyAdminRosterRequestsView,
    AcademyAdminTopRatedView,
    AcademyAdminUserRoleView,
    AcademyAdminUsersView,
)
from .views import (
    AcademyCategoryViewSet,
    AcademyCohortViewSet,
    AcademyCourseViewSet,
    AcademyEnrollmentViewSet,
    AcademyMaterialMuxUploadUrlView,
    AcademyMaterialPlaybackTokenView,
    AcademyMaterialView,
    AcademyTeamViewSet,
    CancelAcademyApplicationView,
    CertificateVerifyView,
    JudgeQueueView,
    MyAcademyApplicationsView,
    RateSubmissionView,
    RosterRequestStatusView,
)

router = DefaultRouter(trailing_slash=False)
router.register("academy-categories", AcademyCategoryViewSet, basename="academy-category")
router.register("academy-courses", AcademyCourseViewSet, basename="academy-course")
router.register("academy-cohorts", AcademyCohortViewSet, basename="academy-cohort")
router.register("academy-enrollments", AcademyEnrollmentViewSet, basename="academy-enrollment")
router.register("academy-teams", AcademyTeamViewSet, basename="academy-team")

urlpatterns = router.urls + [
    path(
        "academy-courses/<int:course_id>/days/<int:day>/material",
        AcademyMaterialView.as_view(),
        name="academy-material",
    ),
    path(
        "academy-courses/<int:course_id>/days/<int:day>/mux-upload-url",
        AcademyMaterialMuxUploadUrlView.as_view(),
        name="academy-material-mux-upload-url",
    ),
    path(
        "academy-courses/<int:course_id>/days/<int:day>/playback-token",
        AcademyMaterialPlaybackTokenView.as_view(),
        name="academy-material-playback-token",
    ),
    path("academy-judging/queue", JudgeQueueView.as_view(), name="academy-judge-queue"),
    path("academy-judging/<int:pk>/rate", RateSubmissionView.as_view(), name="academy-rate-submission"),
    path("academy-certificates/verify/<str:code>", CertificateVerifyView.as_view(), name="academy-certificate-verify"),
    path(
        "academy-roster-requests/<int:pk>/status",
        RosterRequestStatusView.as_view(),
        name="academy-roster-request-status",
    ),
    path("academy-admin/overview", AcademyAdminOverviewView.as_view(), name="academy-admin-overview"),
    path("academy-admin/top-rated", AcademyAdminTopRatedView.as_view(), name="academy-admin-top-rated"),
    path("academy-admin/activity", AcademyAdminActivityView.as_view(), name="academy-admin-activity"),
    path("academy-admin/users", AcademyAdminUsersView.as_view(), name="academy-admin-users"),
    path("academy-admin/users/<int:pk>/role", AcademyAdminUserRoleView.as_view(), name="academy-admin-user-role"),
    path(
        "academy-admin/roster-requests",
        AcademyAdminRosterRequestsView.as_view(),
        name="academy-admin-roster-requests",
    ),
    path("me/academy-applications", MyAcademyApplicationsView.as_view(), name="me-academy-applications"),
    path(
        "academy-applications/<int:pk>/cancel",
        CancelAcademyApplicationView.as_view(),
        name="academy-application-cancel",
    ),
    path("academy-admin/applications", AcademyAdminApplicationsView.as_view(), name="academy-admin-applications"),
]
