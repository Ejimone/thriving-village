from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    """The 6 real account roles, ported 1:1 from backend/src/index.ts's
    ROLE_ACTIONS map (which also has a 7th pseudo-entry, "public", for
    unauthenticated requests — that's not a stored role here, just the
    unauthenticated case)."""

    TALENT = "talent", "Talent"
    EMPLOYER = "employer", "Employer"
    ADMIN = "admin", "Admin"
    STUDENT = "student", "Student"
    FACILITATOR = "facilitator", "Facilitator"
    JUDGE = "judge", "Judge"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.TALENT)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("username", email)
        return self._create_user(email, password, **extra_fields)


ACADEMY_ROLE_CHOICES = [(Role.STUDENT, "Student"), (Role.FACILITATOR, "Facilitator"), (Role.JUDGE, "Judge")]


class AcademyUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        extra_fields.setdefault("role", Role.STUDENT)
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user


class AcademyUser(AbstractBaseUser):
    """Separate auth table for Academy student/facilitator/judge accounts —
    deliberately distinct from `User` above (which stays AUTH_USER_MODEL,
    used by marketplace talent/employer and platform Admin/Django-admin
    login). Mirrors User's relevant fields field-for-field so existing
    Academy code (facilitator.name, member.email/whatsapp, etc.) keeps
    working unchanged with Academy FKs pointed here instead. No
    PermissionsMixin/is_staff/is_superuser — this model never logs into
    Django admin, only the API."""

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, blank=True)
    whatsapp = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=20, choices=ACADEMY_ROLE_CHOICES, default=Role.STUDENT)
    confirmed = models.BooleanField(default=True)
    blocked = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AcademyUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email


class User(AbstractBaseUser, PermissionsMixin):
    """Ported 1:1 from Strapi's extended users-permissions schema
    (backend/src/extensions/users-permissions/content-types/user/schema.json):
    username, email, password, confirmed, blocked, role, name, whatsapp.

    Note `username` is what the frontend actually uses as the display "full
    name" (see signUpAction in src/lib/actions/auth.ts — it sends
    `username: fullName`); the separate `name` field exists in Strapi's
    schema but isn't populated by the current signup flow. Kept here for
    1:1 parity since other surfaces (Academy enrollment) may set it.
    """

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, blank=True)
    whatsapp = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TALENT)
    confirmed = models.BooleanField(default=True)
    blocked = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email
