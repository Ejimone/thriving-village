from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StrapiStylePagination(PageNumberPagination):
    """Mirrors Strapi's list-response envelope so the frontend's `data.ts`
    mapping functions (which read `res.meta.pagination.{page,pageSize,
    pageCount,total}`) need no changes — only the request-side query params
    differ (DRF-idiomatic `?page=`/`?page_size=` instead of Strapi's
    `?pagination[page]=`), per the approved plan.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "data": data,
                "meta": {
                    "pagination": {
                        "page": self.page.number,
                        "pageSize": self.page.paginator.per_page,
                        "pageCount": self.page.paginator.num_pages,
                        "total": self.page.paginator.count,
                    }
                },
            }
        )
