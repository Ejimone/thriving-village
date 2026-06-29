from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_dashboard_views import AdminDashboardActivityView, AdminDashboardStatsView, AdminDashboardStreamView
from .views import (
    BrandViewSet,
    ContestEntryStatusView,
    ContestViewSet,
    CourseViewSet,
    JobApplicationStatusView,
    JobStreamView,
    JobViewSet,
    LessonProgressView,
    MarkProgressView,
    MyApplicationsView,
    MyCoursesView,
    MyEntriesView,
    ProductViewSet,
    SavedJobsView,
    TestimonialViewSet,
    UnsaveJobView,
)

router = DefaultRouter(trailing_slash=False)
router.register("jobs", JobViewSet, basename="job")
router.register("contests", ContestViewSet, basename="contest")
router.register("courses", CourseViewSet, basename="course")
router.register("products", ProductViewSet, basename="product")
router.register("brands", BrandViewSet, basename="brand")
router.register("testimonials", TestimonialViewSet, basename="testimonial")

urlpatterns = router.urls + [
    path("saved-jobs", SavedJobsView.as_view(), name="saved-jobs"),
    path("saved-jobs/<slug:job_slug>", UnsaveJobView.as_view(), name="unsave-job"),
    path("lesson-progresses", LessonProgressView.as_view(), name="lesson-progresses"),
    path("progress", MarkProgressView.as_view(), name="mark-progress"),
    path("me/applications", MyApplicationsView.as_view(), name="me-applications"),
    path("me/entries", MyEntriesView.as_view(), name="me-entries"),
    path("me/courses", MyCoursesView.as_view(), name="me-courses"),
    path("job-applications/<int:pk>", JobApplicationStatusView.as_view(), name="job-application-status"),
    path("contest-entries/<int:pk>", ContestEntryStatusView.as_view(), name="contest-entry-status"),
    path("admin-dashboard/stats", AdminDashboardStatsView.as_view(), name="admin-dashboard-stats"),
    path("admin-dashboard/activity", AdminDashboardActivityView.as_view(), name="admin-dashboard-activity"),
    path("admin-dashboard/stream", AdminDashboardStreamView.as_view(), name="admin-dashboard-stream"),
    path("job-stream", JobStreamView.as_view(), name="job-stream"),
]
