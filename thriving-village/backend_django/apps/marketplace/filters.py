import django_filters

from .models import Course, Job, Product


class JobFilter(django_filters.FilterSet):
    locationType = django_filters.CharFilter(field_name="location_type")

    class Meta:
        model = Job
        fields = ["field", "level", "type"]


class CourseFilter(django_filters.FilterSet):
    # Matches src/lib/data.ts's PRICE_BANDS (gte/lt pairs) — Strapi's price
    # bands were a client-side filter there; promoted to real server-side
    # range filtering here since flat DRF params can't express a band the
    # way Strapi's nested `filters.price.$gte/$lt` could in one shot.
    priceMin = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    priceMax = django_filters.NumberFilter(field_name="price", lookup_expr="lt")

    class Meta:
        model = Course
        fields = ["field", "level", "kind", "delivery"]


class ProductFilter(django_filters.FilterSet):
    priceMin = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    priceMax = django_filters.NumberFilter(field_name="price", lookup_expr="lt")

    class Meta:
        model = Product
        fields = ["category", "type", "condition"]
