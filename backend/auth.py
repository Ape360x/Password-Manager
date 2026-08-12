"""
JWT issuing + a decorator that gives route handlers a ready-to-use
`vault_key` (bytes) without the server ever having to store the user's
master password.

How the vault key survives between requests:
  login -> derive master_key from password -> unwrap the DB's
  wrapped_vault_key -> re-wrap that vault key under the server's own
  secret (KEY_WRAP_SECRET) -> stash the result as a claim inside the
  signed, short-lived JWT we hand back to the browser.

Every later request carries that JWT; we verify the signature (proves it
hasn't been tampered with and was issued by us), then unwrap the vault
key claim using the same server secret. The browser never sees the
master password or the raw vault key's server secret.
"""
from functools import wraps

from flask import current_app, g, jsonify
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    verify_jwt_in_request,
)

import crypto_utils


def issue_access_token(user, vault_key: bytes) -> str:
    wrapped = crypto_utils.wrap_vault_key_for_session(
        vault_key, current_app.config["KEY_WRAP_SECRET"]
    )
    return create_access_token(
        identity=str(user.id),
        additional_claims={"vk": wrapped, "un": user.username},
    )


def vault_key_required(fn):
    """Route decorator: verifies the JWT, then sets g.user_id and
    g.vault_key for the duration of the request. Never persists the key
    anywhere; it just lives in request-local `g` and is discarded when
    the response is sent."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        wrapped_vk = claims.get("vk")
        if not wrapped_vk:
            return jsonify({"error": "Invalid session"}), 401
        try:
            g.vault_key = crypto_utils.unwrap_vault_key_from_session(
                wrapped_vk, current_app.config["KEY_WRAP_SECRET"]
            )
        except ValueError:
            return jsonify({"error": "Session expired or invalid, please log in again"}), 401
        g.user_id = int(get_jwt_identity())
        return fn(*args, **kwargs)

    return wrapper
