from rest_framework.response import Response

from apps.core.cache import cached


class CachedListMixin:
    """Wraps `list()` in the same cache-aside pattern Strapi's job/contest/
    course controllers use (`cached('jobs', JSON.stringify(ctx.query), 30,
    ...)`): cache key = scope + raw query string, so different filter/page
    combinations get independent cache entries. Set `cache_scope` and
    `cache_ttl` on the viewset; call `invalidate_scope(cache_scope)` after
    any write (done in the writable viewsets added in Stage 3+).
    """

    cache_scope: str | None = None
    cache_ttl: int = 30

    def list(self, request, *args, **kwargs):
        if not self.cache_scope:
            return super().list(request, *args, **kwargs)

        cache_key = request.get_full_path()

        def build():
            response = super(CachedListMixin, self).list(request, *args, **kwargs)
            return response.data

        return Response(cached(self.cache_scope, cache_key, self.cache_ttl, build))


class EnvelopeMixin:
    """Wraps single-object responses in `{ data: ... }`, matching Strapi's
    `StrapiSingleResponse<T>` shape (src/lib/strapi.ts). List responses are
    already enveloped by StrapiStylePagination — this only covers
    retrieve/create/update/partial_update, which DRF's generic views return
    unwrapped by default.
    """

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        response.data = {"data": response.data}
        return response

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        response.data = {"data": response.data}
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        response.data = {"data": response.data}
        return response


class UnwrapDataMixin:
    """Strapi's admin write calls always send `{ data: {...} }` (see
    `writeEntity` in src/lib/actions/admin.ts, shared by every admin
    save/delete action) — unwrap that envelope before it reaches the write
    serializer, so the frontend's request-body shape needs no changes even
    though the query-string dialect changed (per the approved plan, only
    src/lib/data.ts's query building was in scope for changes, not the
    write-body shape).
    """

    def get_serializer(self, *args, **kwargs):
        data = kwargs.get("data")
        if isinstance(data, dict) and "data" in data and self.action in ("create", "update", "partial_update"):
            kwargs["data"] = data["data"]
        return super().get_serializer(*args, **kwargs)


class PkForWriteMixin:
    """Public reads use `lookup_field = "slug"` (pretty URLs), but the admin
    UI's write calls (src/lib/actions/admin.ts's `writeEntity`/
    `deleteEntity`) always address rows by `documentId` — which here is just
    the numeric PK as a string (see DocumentIdMixin) — matching Strapi's own
    write-by-documentId behavior (`idOrDocumentIdWhere` in
    backend/src/utils/scoped-find.ts). Routes write actions to a PK lookup
    instead of the slug one.
    """

    def get_object(self):
        if self.action in ("update", "partial_update", "destroy"):
            from django.shortcuts import get_object_or_404

            lookup_value = self.kwargs[self.lookup_url_kwarg or self.lookup_field]
            obj = get_object_or_404(self.filter_queryset(self.get_queryset()), pk=lookup_value)
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()


class DocumentIdMixin:
    """Emits `documentId` as a string alias of the Django PK on every
    serializer that uses it, so frontend code reading `documentId` (the
    field name Strapi uses for its internal identifier) needs no changes.
    """

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["documentId"] = str(instance.pk)
        return data


def envelope_single(data):
    return Response({"data": data})
