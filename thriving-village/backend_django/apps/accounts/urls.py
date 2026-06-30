from django.urls import path

from .views import AcademyLoginView, AcademyMeView, AcademyRegisterView, LoginView, MeView, RegisterView

urlpatterns = [
    path("auth/local", LoginView.as_view(), name="auth-local"),
    path("auth/register", RegisterView.as_view(), name="auth-register"),
    path("me", MeView.as_view(), name="me"),
    path("academy/auth/local", AcademyLoginView.as_view(), name="academy-auth-local"),
    path("academy/auth/register", AcademyRegisterView.as_view(), name="academy-auth-register"),
    path("academy/me", AcademyMeView.as_view(), name="academy-me"),
]
