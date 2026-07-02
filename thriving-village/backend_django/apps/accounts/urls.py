from django.urls import path

from .views import (
    AcademyForgotPasswordView,
    AcademyLoginView,
    AcademyMeView,
    AcademyRegisterView,
    AcademyResetPasswordView,
    AcademySupabaseExchangeView,
    ForgotPasswordView,
    LoginView,
    MeView,
    RegisterView,
    ResetPasswordView,
    SupabaseExchangeView,
)

urlpatterns = [
    path("auth/local", LoginView.as_view(), name="auth-local"),
    path("auth/register", RegisterView.as_view(), name="auth-register"),
    path("auth/forgot-password", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("auth/reset-password", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("auth/supabase", SupabaseExchangeView.as_view(), name="auth-supabase"),
    path("me", MeView.as_view(), name="me"),
    path("academy/auth/local", AcademyLoginView.as_view(), name="academy-auth-local"),
    path("academy/auth/register", AcademyRegisterView.as_view(), name="academy-auth-register"),
    path("academy/auth/forgot-password", AcademyForgotPasswordView.as_view(), name="academy-auth-forgot-password"),
    path("academy/auth/reset-password", AcademyResetPasswordView.as_view(), name="academy-auth-reset-password"),
    path("academy/auth/supabase", AcademySupabaseExchangeView.as_view(), name="academy-auth-supabase"),
    path("academy/me", AcademyMeView.as_view(), name="academy-me"),
]
