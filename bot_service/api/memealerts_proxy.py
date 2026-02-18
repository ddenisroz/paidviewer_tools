"""
Reverse-proxy for memealerts.com.

Opens memealerts.com through our own origin so the popup can pass
access token data back to dashboard via postMessage.
"""

from __future__ import annotations

import logging
import re

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect

from auth.auth import get_current_user_optional
from core.database import get_db
from core.token_encryption import decrypt_token
from repositories.user_token_repository import UserTokenRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memealerts/proxy", tags=["memealerts-proxy"])

MEMEALERTS_ORIGIN = "https://memealerts.com"
MEMEALERTS_WWW_ORIGIN = "https://www.memealerts.com"
PROXY_PREFIX = "/api/memealerts/proxy"

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

_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

_INJECTED_SCRIPT = """
<script data-ma-proxy="1">
(function () {
  var handled = false;

  function notifyOpener(type, payload) {
    if (!window.opener) return;
    try {
      var data = payload || {};
      data.type = type;
      window.opener.postMessage(data, "*");
    } catch (e) {}
  }

  function pickToken(params) {
    var access =
      params.get("access_token") ||
      params.get("accessToken") ||
      params.get("token") ||
      params.get("auth_token") ||
      params.get("jwt") ||
      "";
    if (!access) return {};
    return {
      access_token: access,
      refresh_token: params.get("refresh_token") || params.get("refreshToken") || undefined,
    };
  }

  function readUrlToken() {
    try {
      var url = new URL(window.location.href);
      var fromQuery = pickToken(url.searchParams);
      if (fromQuery.access_token) return fromQuery;

      var hash = (window.location.hash || "").replace(/^#/, "");
      if (!hash) return {};

      var hashParams = pickToken(new URLSearchParams(hash));
      if (hashParams.access_token) return hashParams;

      var queryIndex = hash.indexOf("?");
      if (queryIndex >= 0) {
        var hashQuery = hash.slice(queryIndex + 1);
        var fromHashQuery = pickToken(new URLSearchParams(hashQuery));
        if (fromHashQuery.access_token) return fromHashQuery;
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  function looksLikeToken(value) {
    if (typeof value !== "string") return false;
    var token = value.trim();
    if (!token) return false;
    if (token.split(".").length === 3) return true;
    return token.length >= 24;
  }

  function extractFromUnknown(rawValue) {
    if (typeof rawValue !== "string" || !rawValue) return {};

    var direct = rawValue.trim();
    if (looksLikeToken(direct)) {
      return { access_token: direct };
    }

    try {
      var parsed = JSON.parse(direct);
      if (parsed && typeof parsed === "object") {
        var access =
          parsed.access_token ||
          parsed.accessToken ||
          parsed.token ||
          parsed.jwt ||
          "";
        if (looksLikeToken(access)) {
          return {
            access_token: access,
            refresh_token: parsed.refresh_token || parsed.refreshToken || undefined,
          };
        }
      }
    } catch (e) {}

    try {
      var params = new URLSearchParams(direct.replace(/^[#?]/, ""));
      var fromParams = pickToken(params);
      if (fromParams.access_token) return fromParams;
    } catch (e) {}

    return {};
  }

  function readStorageToken() {
    try {
      var knownKeys = [
        "accessToken",
        "access_token",
        "token",
        "authToken",
        "jwt",
        "jwtToken",
        "ma_token",
        "ma_access_token",
      ];
      for (var i = 0; i < knownKeys.length; i += 1) {
        var directValue = localStorage.getItem(knownKeys[i]);
        var extractedDirect = extractFromUnknown(directValue || "");
        if (extractedDirect.access_token) {
          return {
            access_token: extractedDirect.access_token,
            refresh_token:
              extractedDirect.refresh_token ||
              localStorage.getItem("refreshToken") ||
              localStorage.getItem("refresh_token") ||
              undefined,
          };
        }
      }

      for (var idx = 0; idx < localStorage.length; idx += 1) {
        var key = localStorage.key(idx);
        if (!key) continue;
        var value = localStorage.getItem(key);
        var extracted = extractFromUnknown(value || "");
        if (extracted.access_token) {
          return {
            access_token: extracted.access_token,
            refresh_token:
              extracted.refresh_token ||
              localStorage.getItem("refreshToken") ||
              localStorage.getItem("refresh_token") ||
              undefined,
          };
        }
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  function cleanupStorage() {
    try {
      var keys = [
        "accessToken",
        "access_token",
        "refreshToken",
        "refresh_token",
        "token",
        "authToken",
        "jwt",
        "jwtToken",
      ];
      for (var i = 0; i < keys.length; i += 1) {
        localStorage.removeItem(keys[i]);
      }
    } catch (e) {}
  }

  async function persistToken(payload) {
    try {
      var response = await fetch("/api/memealerts/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        }),
      });
      var data = null;
      try {
        data = await response.json();
      } catch (e) {}
      var ok = response.ok;
      if (data && typeof data.success === "boolean") {
        ok = ok && data.success;
      }
      return { ok: ok, status: response.status };
    } catch (e) {
      return { ok: false, status: 0 };
    }
  }

  async function processToken(payload, source) {
    if (handled || !payload || !payload.access_token) return;
    handled = true;

    notifyOpener("memealerts_token", {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    var persistResult = await persistToken(payload);
    notifyOpener("memealerts_proxy_result", {
      ok: !!persistResult.ok,
      status: persistResult.status || 0,
      source: source || "unknown",
    });

    cleanupStorage();
    setTimeout(function () {
      window.close();
    }, persistResult.ok ? 350 : 900);
  }

  var tries = 0;
  var maxTries = 240;

  var initialToken = readUrlToken();
  if (initialToken.access_token) {
    processToken(initialToken, "url");
    return;
  }

  var interval = setInterval(function () {
    tries += 1;

    var fromUrl = readUrlToken();
    if (fromUrl.access_token) {
      clearInterval(interval);
      processToken(fromUrl, "url");
      return;
    }

    var fromStorage = readStorageToken();
    if (fromStorage.access_token) {
      clearInterval(interval);
      processToken(fromStorage, "storage");
      return;
    }

    if (tries >= maxTries) {
      clearInterval(interval);
    }
  }, 500);
})();
</script>
"""

_PATH_FIX_SCRIPT = """
<script data-ma-route-fix="1">
(function () {
  try {
    if (window.location.pathname.indexOf('/api/memealerts/proxy') === 0) {
      var next = '/' + (window.location.search || '') + (window.location.hash || '');
      history.replaceState({}, '', next);
    }
  } catch (e) {}
})();
</script>
"""


def _rewrite_set_cookie(value: str, request: Request) -> str:
    # Convert upstream cookies to current host scope so browser keeps them
    # for subsequent proxy requests (anti-bot/session cookies).
    rewritten = re.sub(r";\s*Domain=[^;]+", "", value, flags=re.IGNORECASE)
    if request.url.scheme != "https":
        rewritten = re.sub(r";\s*Secure", "", rewritten, flags=re.IGNORECASE)
        rewritten = re.sub(r";\s*SameSite=None", "; SameSite=Lax", rewritten, flags=re.IGNORECASE)
    return rewritten


def _normalize_query(path: str, query: list[tuple[str, str]] | None) -> list[tuple[str, str]] | None:
    return query


def _normalize_auth_query(
    path: str,
    query: list[tuple[str, str]] | None,
    *,
    proxy_return_url: str,
) -> list[tuple[str, str]] | None:
    if not query:
        query = []

    if not path.startswith("api/auth/"):
        return query

    normalized: list[tuple[str, str]] = []
    has_return_url = False
    for key, value in query:
        if key == "return_url":
            has_return_url = True
            # Respect explicit callback URL from caller. This allows frontend-owned
            # callback pages (same-origin with opener) for automatic token handoff.
            normalized.append((key, value))
        else:
            normalized.append((key, value))

    if not has_return_url:
        normalized.append(("return_url", proxy_return_url))

    return normalized


def _build_upstream_auth_fallback_query(
    path: str,
    query: list[tuple[str, str]] | None,
) -> list[tuple[str, str]] | None:
    if not query or not path.startswith("api/auth/"):
        return query

    normalized: list[tuple[str, str]] = []
    has_return_url = False
    for key, value in query:
        if key == "return_url":
            has_return_url = True
            normalized.append((key, f"{MEMEALERTS_ORIGIN}/auth/redirect"))
        else:
            normalized.append((key, value))

    if not has_return_url:
        normalized.append(("return_url", f"{MEMEALERTS_ORIGIN}/auth/redirect"))

    return normalized


def _build_upstream_url(path: str) -> str:
    if path:
        return f"{MEMEALERTS_ORIGIN}/{path}"
    return f"{MEMEALERTS_ORIGIN}/"


def _rewrite_body(body: bytes, content_type: str, proxy_prefix: str) -> bytes:
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

    text = text.replace("https://memealerts.com/", f"{proxy_prefix}/")
    text = text.replace("https://memealerts.com", proxy_prefix)
    text = text.replace("https://www.memealerts.com/", f"{proxy_prefix}/")
    text = text.replace("https://www.memealerts.com", proxy_prefix)

    text = re.sub(
        r'((?:src|href|action)\s*=\s*["\'])/(?!/|api/memealerts/proxy/)',
        rf"\1{proxy_prefix}/",
        text,
    )

    text = re.sub(
        r"""(["'])/api/(?!memealerts/proxy/)""",
        rf"\1{proxy_prefix}/api/",
        text,
    )

    text = re.sub(
        r"""(["'])/assets/(?!memealerts/proxy/)""",
        rf"\1{proxy_prefix}/assets/",
        text,
    )

    text = re.sub(
        r"""(["'])/socket\.io/(?!memealerts/proxy/)""",
        rf"\1{proxy_prefix}/socket.io/",
        text,
    )

    text = re.sub(
        r"""(url\(\s*["']?)/(?!/|api/memealerts/proxy/)""",
        rf"\1{proxy_prefix}/",
        text,
    )

    # Guard against repeated prefixing during rewrite passes.
    # Seen in production as:
    # /api/memealerts/proxy/api/memealerts/proxy/...
    double_proxy_prefix = f"{proxy_prefix}/api/memealerts/proxy"
    while double_proxy_prefix in text:
        text = text.replace(double_proxy_prefix, proxy_prefix)

    repeated_prefix = f"{proxy_prefix}{proxy_prefix}"
    while repeated_prefix in text:
        text = text.replace(repeated_prefix, proxy_prefix)

    if is_html:
        if 'data-ma-route-fix="1"' not in text:
            if "<head>" in text:
                text = text.replace("<head>", f"<head>{_PATH_FIX_SCRIPT}", 1)
            else:
                text = f"{_PATH_FIX_SCRIPT}{text}"

    if is_html and 'data-ma-proxy="1"' not in text:
        if "</body>" in text:
            text = text.replace("</body>", f"{_INJECTED_SCRIPT}</body>")
        elif "</html>" in text:
            text = text.replace("</html>", f"{_INJECTED_SCRIPT}</html>")
        else:
            text += _INJECTED_SCRIPT

    return text.encode("utf-8")


def _filter_headers(headers: httpx.Headers, *, is_response: bool = False) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in headers.items():
        lowered = key.lower()
        if lowered in _HOP_BY_HOP:
            continue
        if is_response and lowered.startswith("access-control-"):
            continue
        if is_response and lowered in (
            "strict-transport-security",
            "content-security-policy",
            "content-security-policy-report-only",
            "x-frame-options",
        ):
            continue
        out[key] = value
    return out


@router.get("/", response_class=HTMLResponse)
async def proxy_root(
    request: Request,
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return await _proxy(request, "", user=user, db=db)


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_path(
    request: Request,
    path: str,
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return await _proxy(request, path, user=user, db=db)


async def _proxy(request: Request, path: str, *, user: dict | None = None, db: Session | None = None) -> Response:
    upstream_url = _build_upstream_url(path)
    proxy_prefix = PROXY_PREFIX

    fwd_headers = _filter_headers(request.headers)
    fwd_headers["host"] = "memealerts.com"
    fwd_headers["origin"] = MEMEALERTS_ORIGIN
    fwd_headers["referer"] = f"{MEMEALERTS_ORIGIN}/"
    fwd_headers["accept-encoding"] = "identity"

    # When user is logged in on our side, attach stored MemeAlerts OAuth token
    # to proxied API calls. This enables API usage through browser context
    # without requiring separate MemeAlerts website session cookies.
    if path.startswith("api/") and db is not None:
        has_auth_header = any(key.lower() == "authorization" for key in fwd_headers.keys())
        if not has_auth_header:
            user_id = (user or {}).get("id") if isinstance(user, dict) else None
            if user_id:
                token_repo = UserTokenRepository(db)
                token = token_repo.get_by_user_and_platform(user_id, "memealerts")
                if token and token.access_token:
                    try:
                        access_token = decrypt_token(token.access_token)
                    except Exception:
                        access_token = token.access_token
                    fwd_headers["authorization"] = f"Bearer {access_token}"

    try:
        body = await request.body()
    except ClientDisconnect:
        logger.info("[PROXY] Client disconnected before request body was read")
        return Response(content=b"", status_code=499)
    query = list(request.query_params.multi_items()) if request.query_params else None
    query = _normalize_query(path, query)
    proxy_return_url = f"{str(request.base_url).rstrip('/')}{PROXY_PREFIX}/auth/redirect"
    query = _normalize_auth_query(path, query, proxy_return_url=proxy_return_url)

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=False, verify=True) as client:
            upstream_resp = await client.request(
                method=request.method,
                url=upstream_url,
                headers=fwd_headers,
                content=body if body else None,
                params=query,
            )
            if path.startswith("api/auth/") and upstream_resp.status_code >= 400:
                fallback_query = _build_upstream_auth_fallback_query(path, query)
                if fallback_query != query:
                    logger.warning(
                        "[PROXY] Auth flow rejected proxy return_url, retrying with upstream return_url"
                    )
                    upstream_resp = await client.request(
                        method=request.method,
                        url=upstream_url,
                        headers=fwd_headers,
                        content=body if body else None,
                        params=fallback_query,
                    )
    except httpx.TimeoutException:
        logger.warning(f"[PROXY] MemeAlerts upstream timeout: {upstream_url}")
        return Response(content="Gateway Timeout", status_code=504)
    except httpx.RequestError as exc:
        logger.error(f"[PROXY] MemeAlerts upstream error: {exc}")
        return Response(content="Bad Gateway", status_code=502)

    if upstream_resp.is_redirect:
        location = upstream_resp.headers.get("location", "")
        if location.startswith(f"{MEMEALERTS_ORIGIN}/"):
            location = location.replace(f"{MEMEALERTS_ORIGIN}/", f"{proxy_prefix}/")
        elif location.startswith(MEMEALERTS_ORIGIN):
            location = location.replace(MEMEALERTS_ORIGIN, proxy_prefix)
        elif location.startswith(f"{MEMEALERTS_WWW_ORIGIN}/"):
            location = location.replace(f"{MEMEALERTS_WWW_ORIGIN}/", f"{proxy_prefix}/")
        elif location.startswith(MEMEALERTS_WWW_ORIGIN):
            location = location.replace(MEMEALERTS_WWW_ORIGIN, proxy_prefix)
        elif location.startswith("/"):
            location = f"{proxy_prefix}{location}"
        elif location and not location.startswith(("http://", "https://", "data:", "javascript:")):
            location = f"{proxy_prefix}/{location.lstrip('./')}"

        upstream_set_cookies = upstream_resp.headers.get_list("set-cookie")
        resp_headers = _filter_headers(upstream_resp.headers, is_response=True)
        resp_headers["location"] = location
        resp_headers["cache-control"] = "no-store, no-cache, must-revalidate"
        resp_headers["pragma"] = "no-cache"
        resp_headers.pop("set-cookie", None)
        response = Response(content=b"", status_code=upstream_resp.status_code, headers=resp_headers)
        for cookie in upstream_set_cookies:
            response.headers.append("set-cookie", _rewrite_set_cookie(cookie, request))
        return response

    content_type = upstream_resp.headers.get("content-type", "")
    resp_body = _rewrite_body(upstream_resp.content, content_type, proxy_prefix)

    upstream_set_cookies = upstream_resp.headers.get_list("set-cookie")
    resp_headers = _filter_headers(upstream_resp.headers, is_response=True)
    resp_headers["content-length"] = str(len(resp_body))
    if "html" in content_type.lower():
        resp_headers["cache-control"] = "no-store, no-cache, must-revalidate"
        resp_headers["pragma"] = "no-cache"
    resp_headers.pop("set-cookie", None)

    response = Response(
        content=resp_body,
        status_code=upstream_resp.status_code,
        headers=resp_headers,
        media_type=content_type.split(";")[0].strip() if content_type else None,
    )
    for cookie in upstream_set_cookies:
        response.headers.append("set-cookie", _rewrite_set_cookie(cookie, request))
    return response
