"""
Who is calling.

Scans belong to the person who ran them, so the API has to know who that is.
The browser is not asked — it sends the Supabase access token it already holds,
and this module verifies the signature and reads the user id out of the token
itself. A caller cannot name someone else: the id is not a field anyone can
type, it is the `sub` claim of a token signed by Supabase.

Supabase publishes the public half of its signing key at a JWKS endpoint, so
verification needs no secret in the environment — only the project URL. The key
set is fetched once and kept; an unknown key id triggers one refetch, which is
how a key rotation is picked up without a redeploy.
"""

import time
from typing import Any, Optional

import httpx
import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.core.config import SUPABASE_JWKS_URL, REQUIRE_AUTH


# The audience Supabase stamps on a signed-in user's access token. A token
# issued for anything else is not a session and is not accepted here.
_AUDIENCE = "authenticated"

_ALGORITHMS = ["ES256", "RS256", "HS256"]


class _KeyCache:
    """
    The JWKS, fetched once and reused.

    PyJWKClient does its own caching; this wrapper exists so a failure to
    reach Supabase does not become a permanent one — the client is rebuilt on
    the next request rather than left in a broken state.
    """

    def __init__(self) -> None:
        self._client: Optional[PyJWKClient] = None
        self._built_at = 0.0

    def client(self) -> PyJWKClient:
        if self._client is None:
            self._client = PyJWKClient(SUPABASE_JWKS_URL, cache_keys=True)
            self._built_at = time.monotonic()
        return self._client

    def drop(self) -> None:
        self._client = None


_keys = _KeyCache()


class AuthError(HTTPException):
    """401 with a reason a client can act on."""

    def __init__(self, detail: str):
        super().__init__(status_code=401, detail=detail)


def _bearer(authorization: Optional[str]) -> Optional[str]:
    """The token out of an Authorization header, or None if there isn't one."""

    if not authorization:
        return None

    parts = authorization.split(None, 1)

    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1].strip()

    return token or None


def verify_token(token: str) -> dict[str, Any]:
    """
    Verifies a Supabase access token and returns its claims.

    Raises AuthError for anything that is not a currently valid token for this
    project — expired, wrong audience, wrong signature, or signed by a key
    this project does not publish.
    """

    def decode() -> dict[str, Any]:
        signing_key = _keys.client().get_signing_key_from_jwt(token)

        return jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
            # Supabase sets `exp` on every access token; a session that has
            # run out is not a session.
            options={"require": ["exp", "sub"]},
        )

    try:
        return decode()

    except jwt.ExpiredSignatureError:
        raise AuthError("Your session has expired. Sign in again.")

    except jwt.InvalidAudienceError:
        raise AuthError("This token was not issued for a signed-in user.")

    except jwt.PyJWKClientError:
        # Most often a rotated key: the cached set no longer contains the id
        # this token names. One refetch, then the original error stands.
        _keys.drop()

        try:
            return decode()

        except Exception:
            raise AuthError("This token could not be verified.")

    except (httpx.HTTPError, OSError):
        # Supabase itself is unreachable. That is not the caller's fault and
        # must not be reported as a rejected token.
        raise HTTPException(
            status_code=503,
            detail="The sign-in service is unreachable. Try again shortly.",
        )

    except jwt.InvalidTokenError:
        raise AuthError("This token could not be verified.")


def current_user_id(
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """
    The signed-in user's id, verified — or None when the deployment has no
    Supabase project configured.

    The None case is local development without Supabase. It does not mean
    "everyone": callers scope their reads to a null owner, so an unconfigured
    deployment sees only scans that were themselves recorded without a user.
    Nobody's history is handed to nobody in particular.
    """

    token = _bearer(authorization)

    if not REQUIRE_AUTH:
        # Still honoured when present, so a configured client and an
        # unconfigured one do not disagree about who is asking.
        return verify_token(token)["sub"] if token else None

    if not token:
        raise AuthError("Sign in to continue.")

    return verify_token(token)["sub"]


def required_user_id(
    user_id: Optional[str] = Depends(current_user_id),
) -> Optional[str]:
    """
    The same, for endpoints that must not serve an anonymous caller once a
    project is configured. With no project configured this is the null owner,
    which owns nothing but the rows recorded the same way.
    """

    return user_id
