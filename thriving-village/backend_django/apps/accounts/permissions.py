"""Role-based permission classes mapped directly from backend/src/index.ts's
ROLE_ACTIONS table. `public` there means "no auth required" — modeled here
as plain DRF AllowAny/IsAuthenticatedOrReadOnly at the view level, not a
permission class of its own.
"""

from rest_framework.permissions import BasePermission

from .models import Role


class HasRole(BasePermission):
    """Base class — subclasses set `allowed_roles`."""

    allowed_roles: set[str] = set()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsAdminRole(HasRole):
    allowed_roles = {Role.ADMIN}


class IsTalentOrEmployer(HasRole):
    """Marketplace actions: apply/enter/enroll/save — Talent and Employer
    have identical access today (Strapi's TALENT_ACTIONS list is reused
    verbatim for both roles)."""

    allowed_roles = {Role.TALENT, Role.EMPLOYER}


class IsStudentRole(HasRole):
    allowed_roles = {Role.STUDENT}


class IsFacilitatorRole(HasRole):
    allowed_roles = {Role.FACILITATOR}


class IsJudgeRole(HasRole):
    allowed_roles = {Role.JUDGE}


class IsAcademyAdminOrFacilitator(HasRole):
    """Admin has full Academy access (confirmed product decision: one
    platform-admin login covers both domains); Facilitator is scoped further
    at the object/queryset level by IsCohortFacilitator below."""

    allowed_roles = {Role.ADMIN, Role.FACILITATOR}


class IsCohortFacilitator(BasePermission):
    """Object-level check: a facilitator may only act on cohorts they own.
    ACADEMY_BACKEND_SPEC.md calls this a hard rule — every facilitator
    endpoint must filter to `cohort.facilitatorId == currentUser.id`. Admins
    bypass this (full access)."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == Role.ADMIN:
            return True
        if user.role != Role.FACILITATOR:
            return False
        cohort = obj if obj.__class__.__name__ == "AcademyCohort" else getattr(obj, "cohort", None)
        return bool(cohort and cohort.facilitator_id == user.id)
