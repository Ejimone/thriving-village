from .slugs import slugify, unique_slug


class AutoSlugAdminMixin:
    """Generates `slug` server-side from `slug_source_field` whenever it's
    left blank, so admins never have to type one — mirrors the same
    `slugify`/`unique_slug` logic the write serializers already use for
    API-driven creates (apps/core/slugs.py), instead of relying solely on
    `prepopulated_fields`' admin-JS auto-fill, which only runs in the
    browser and still lets the field be cleared or left empty.

    The model's `slug` field is `blank=False` (every row must end up with
    one), so the admin form's own validation would otherwise reject an
    empty submission before `save_model` ever runs — `get_form` relaxes
    that for the admin form specifically, since the actual value always
    gets filled in below before the row is saved.
    """

    slug_source_field: str = "title"

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if "slug" in form.base_fields:
            form.base_fields["slug"].required = False
        return form

    def save_model(self, request, obj, form, change):
        if not obj.slug:
            base = slugify(getattr(obj, self.slug_source_field, "") or "")
            obj.slug = unique_slug(type(obj), base)
        super().save_model(request, obj, form, change)
