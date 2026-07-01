from django.middleware.gzip import GZipMiddleware


class ApiGZipMiddleware(GZipMiddleware):
    """GZipMiddleware that skips text/event-stream responses.

    Django's GZipMiddleware wraps StreamingHttpResponse content in a gzip
    stream, which buffers chunks until the compressor decides to flush — this
    delays SSE event delivery and breaks real-time behaviour. Skip compression
    for SSE responses; every other response type is compressed as normal.
    """

    def process_response(self, request, response):
        if "text/event-stream" in response.get("Content-Type", ""):
            return response
        return super().process_response(request, response)
