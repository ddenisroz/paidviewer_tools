"""
Reverse-proxy for memealerts.com.

Opens memealerts.com through our own origin so that the SPA stores its
JWT ``accessToken`` in **our** domain's localStorage.  The frontend can
then read it with plain ``window.localStorage.getItem('accessToken')``
and send it to the regular ``/api/memealerts/connect`` endpoint.

Only used during the short OAuth-login popup flow.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memealerts/proxy", tags=["memealerts-proxy"])

MEMEALERTS_ORIGIN = "https://memealerts.com"

# Headers we do NOT want to forward to/from the upstream server.
_HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "content-encoding",
        "content-length",
        "host",
    }
)

# Timeout for upstream requests.
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# A small JS snippet injected into the proxied HTML page.  It watches
# localStorage for the appearance of ``accessToken`` and, once found,
# posts it to the opener window via ``postMessage`` so our React app can
# pick it up automatically.
_INJECTED_SCRIPT = """
<script data-ma-proxy="1">
(function(){
  // Poll localStorage for the token that MemeAlerts SPA writes after login.
  var _iv = setInterval(function(){
    try {
      var t = localStorage.getItem('accessToken');
      if (!t) return;
      clearInterval(_iv);
      // Notify opener (our dashboard) about the token.
      if (window.opener) {
        window.opener.postMessage({
          type: 'memealerts_token',
          access_token: t,
          refresh_token: localStorage.getItem('refreshToken') || undefined
        }, '*');
      }
      // Clean up — remove the MA tokens from our domain's localStorage
      // so they don't leak or interfere.
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Give the postMessage a moment to arrive, then close the popup.
      setTimeout(function(){ window.close(); }, 600);
    } catch(e) {}
  }, 500);
})();
</script>
"""


def _build_upstream_url(path: str) -> str:
    """Build the full upstream URL for *path* (may be empty)."""
    if path:
        return f"{MEMEALERTS_ORIGIN}/{path}"
    return f"{MEMEALERTS_ORIGIN}/"


def _rewrite_body(body: bytes, content_type: str, proxy_prefix: str) -> bytes:
    """Rewrite URLs inside HTML / JS / CSS responses so they go through the proxy."""
    if not content_type:
        return body

    ct_lower = content_type.lower()
    is_html = "html" in ct_lower
    is_js = "javascript" in ct_lower
    is_css = "css" in ct_lower

    if not (is_html or is_js or is_css):
        return body

    try:
        text = body.decode("utf-8", errors="replace")
    except Exception:
        return body

    # Rewrite absolute URLs pointing to memealerts.com.
    text = text.replace("https://memealerts.com/", f"{proxy_prefix}/")
    text = text.replace("https://memealerts.com", proxy_prefix)

    # Rewrite root-relative hrefs/srcs (but NOT protocol-relative //…).
    # e.g.  src="/app-xxx.js"  ->  src="/api/memealerts/proxy/app-xxx.js"
    text = re.sub(
        r'((?:src|href|action)\s*=\s*["\'])/(?!/)',
        rf"\1{proxy_prefix}/",
        text,
    )

    # Rewrite fetch/XHR calls that start with "/api" (MemeAlerts internal API).
    text = re.sub(
        r"""(["'])/api/""",
        rf"\1{proxy_prefix}/api/",
        text,
    )

    # For HTML responses inject our token-watcher script right before </body>.
    if is_html:
        if "</body>" in text:
            text = text.replace("</body>", f"{_INJECTED_SCRIPT}</body>")
        elif "</html>" in text:
            text = text.replace("</html>", f"{_INJECTED_SCRIPT}</html>")
        else:
            text += _INJECTED_SCRIPT

    return text.encode("utf-8")


def _filter_headers(headers: httpx.Headers, *, is_response: bool = False) -> dict[str, str]:
    """Return a dict of headers with hop-by-hop entries removed."""
    out: dict[str, str] = {}
    for key, value in headers.items():
        if key.lower() in _HOP_BY_HOP:
            continue
        # Drop CORS headers from upstream — our middleware adds its own.
        if is_response and key.lower().startswith("access-control-"):
            continue
        # Drop strict-transport / CSP that would break proxied rendering.
        if is_response and key.lower() in (
            "strict-transport-security",
            "content-security-policy",
            "content-security-policy-report-only",
            "x-frame-options",
        ):
            continue
        out[key] = value
    return out


# ---- ROUTES ----


@router.get("/", response_class=HTMLResponse)
async def proxy_root(request: Request):
    """Proxy the MemeAlerts root page."""
    return await _proxy(request, "")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_path(request: Request, path: str):
    """Proxy any sub-path of memealerts.com."""
    return await _proxy(request, path)


async def _proxy(request: Request, path: str) -> Response:
    """Core proxy logic: forward *request* to MemeAlerts and return the response."""
    upstream_url = _build_upstream_url(path)
    proxy_prefix = "/api/memealerts/proxy"

    # Build upstream headers.
    fwd_headers = _filter_headers(request.headers)
    fwd_headers["host"] = "memealerts.com"
    fwd_headers["origin"] = MEMEALERTS_ORIGIN
    fwd_headers["referer"] = f"{MEMEALERTS_ORIGIN}/"

    # Read the request body (for POST etc.).
    body = await request.body()

    # Forward query-string as-is.
    query = str(request.query_params) if request.query_params else None

    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=False,
            verify=True,
        ) as client:
            upstream_resp = await client.request(
                method=request.method,
                url=upstream_url,
                headers=fwd_headers,
                content=body if body else None,
                params=query,
            )
    except httpx.TimeoutException:
        logger.warning(f"[PROXY] MemeAlerts upstream timeout: {upstream_url}")
        return Response(content="Gateway Timeout", status_code=504)
    except httpx.RequestError as exc:
        logger.error(f"[PROXY] MemeAlerts upstream error: {exc}")
        return Response(content="Bad Gateway", status_code=502)

    # Handle redirects — rewrite Location header.
    if upstream_resp.is_redirect:
        location = upstream_resp.headers.get("location", "")
        if location.startswith("https://memealerts.com/"):
            location = location.replace("https://memealerts.com/", f"{proxy_prefix}/")
        elif location.startswith("https://memealerts.com"):
            location = location.replace("https://memealerts.com", proxy_prefix)
        elif location.startswith("/"):
            location = f"{proxy_prefix}{location}"

        resp_headers = _filter_headers(upstream_resp.headers, is_response=True)
        resp_headers["location"] = location
        return Response(
            content=b"",
            status_code=upstream_resp.status_code,
            headers=resp_headers,
        )

    # Rewrite body for text-based content.
    content_type = upstream_resp.headers.get("content-type", "")
    resp_body = _rewrite_body(upstream_resp.content, content_type, proxy_prefix)

    resp_headers = _filter_headers(upstream_resp.headers, is_response=True)
    # Update content-length after potential rewrite.
    resp_headers["content-length"] = str(len(resp_body))

    return Response(
        content=resp_body,
        status_code=upstream_resp.status_code,
        headers=resp_headers,
        media_type=content_type.split(";")[0].strip() if content_type else None,
    )
