from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path

from apps.academy.views import MuxWebhookView

urlpatterns = [
    path("", lambda request: redirect("/admin/")),
    path("admin/", admin.site.urls),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.marketplace.urls")),
    path("api/", include("apps.academy.urls")),
    path("webhooks/mux", MuxWebhookView.as_view(), name="mux-webhook"),
]
