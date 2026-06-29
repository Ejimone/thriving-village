from django.urls import path

from .views import LoginView, MeView, RegisterView

urlpatterns = [
    path("auth/local", LoginView.as_view(), name="auth-local"),
    path("auth/register", RegisterView.as_view(), name="auth-register"),
    path("me", MeView.as_view(), name="me"),
]
