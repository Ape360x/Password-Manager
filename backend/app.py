import re
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity

import crypto_utils
from auth import issue_access_token, vault_key_required
from config import Config
from models import db, User, VaultEntry

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
MIN_PASSWORD_LENGTH = 10
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    JWTManager(app)
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    with app.app_context():
        db.create_all()

    register_routes(app)
    register_error_handlers(app)
    return app


def password_strength_errors(password: str):
    errors = []
    if len(password) < MIN_PASSWORD_LENGTH:
        errors.append(f"Master password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if not re.search(r"[a-z]", password):
        errors.append("Include at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        errors.append("Include at least one uppercase letter.")
    if not re.search(r"\d", password):
        errors.append("Include at least one digit.")
    return errors


def register_routes(app):
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        if not USERNAME_RE.match(username):
            return jsonify({"error": "Username must be 3-32 characters: letters, "
                                      "numbers, '.', '_' or '-'."}), 400

        strength_errors = password_strength_errors(password)
        if strength_errors:
            return jsonify({"error": " ".join(strength_errors)}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({"error": "That username is already taken."}), 409

        iterations = app.config["PBKDF2_ITERATIONS"]
        kdf_salt = crypto_utils.generate_salt()
        master_key = crypto_utils.derive_master_key(password, kdf_salt, iterations)

        vault_key = crypto_utils.generate_vault_key()
        wrapped_vault_key = crypto_utils.wrap_vault_key_with_master_key(vault_key, master_key)

        user = User(
            username=username,
            auth_hash=crypto_utils.hash_password(password),
            kdf_salt=kdf_salt,
            kdf_iterations=iterations,
            wrapped_vault_key=wrapped_vault_key,
        )
        db.session.add(user)
        db.session.commit()

        token = issue_access_token(user, vault_key)
        return jsonify({"access_token": token, "username": user.username}), 201

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------
    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        user = User.query.filter_by(username=username).first()

        # Constant-shape response whether or not the username exists, to
        # avoid leaking which usernames are registered.
        generic_error = jsonify({"error": "Invalid username or password."}), 401

        if user is None:
            # Still do a dummy hash to keep response timing similar.
            crypto_utils.hash_password("dummy-password-for-timing")
            return generic_error

        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
            return jsonify({"error": f"Account locked. Try again in {remaining} minute(s)."}), 423

        if not crypto_utils.verify_password(user.auth_hash, password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
            db.session.commit()
            return generic_error

        # Success: reset lockout tracking.
        user.failed_login_attempts = 0
        user.locked_until = None
        if crypto_utils.needs_rehash(user.auth_hash):
            user.auth_hash = crypto_utils.hash_password(password)
        db.session.commit()

        try:
            master_key = crypto_utils.derive_master_key(password, user.kdf_salt, user.kdf_iterations)
            vault_key = crypto_utils.unwrap_vault_key_with_master_key(user.wrapped_vault_key, master_key)
        except Exception:
            return jsonify({"error": "Could not unlock vault. Contact support."}), 500

        token = issue_access_token(user, vault_key)
        return jsonify({"access_token": token, "username": user.username})

    @app.get("/api/me")
    @vault_key_required
    def me():
        user = User.query.get_or_404(g.user_id)
        return jsonify({"username": user.username, "entry_count": len(user.entries)})

    # ------------------------------------------------------------------
    # Vault entries (all require a valid session + unwrapped vault key)
    # ------------------------------------------------------------------
    @app.get("/api/vault")
    @vault_key_required
    def list_entries():
        entries = (
            VaultEntry.query.filter_by(user_id=g.user_id)
            .order_by(VaultEntry.site_name.asc())
            .all()
        )
        return jsonify([serialize_entry(e, g.vault_key) for e in entries])

    @app.post("/api/vault")
    @vault_key_required
    def create_entry():
        data = request.get_json(silent=True) or {}
        site_name = (data.get("site_name") or "").strip()
        if not site_name:
            return jsonify({"error": "site_name is required."}), 400
        if not data.get("password"):
            return jsonify({"error": "password is required."}), 400

        entry = VaultEntry(
            user_id=g.user_id,
            site_name=site_name,
            site_url=(data.get("site_url") or "").strip() or None,
            username_enc=crypto_utils.encrypt_field(g.vault_key, data.get("username", "")),
            password_enc=crypto_utils.encrypt_field(g.vault_key, data["password"]),
            notes_enc=crypto_utils.encrypt_field(g.vault_key, data.get("notes", "")),
        )
        db.session.add(entry)
        db.session.commit()
        return jsonify(serialize_entry(entry, g.vault_key)), 201

    @app.put("/api/vault/<int:entry_id>")
    @vault_key_required
    def update_entry(entry_id):
        entry = VaultEntry.query.filter_by(id=entry_id, user_id=g.user_id).first_or_404()
        data = request.get_json(silent=True) or {}

        if "site_name" in data:
            if not data["site_name"].strip():
                return jsonify({"error": "site_name cannot be empty."}), 400
            entry.site_name = data["site_name"].strip()
        if "site_url" in data:
            entry.site_url = (data["site_url"] or "").strip() or None
        if "username" in data:
            entry.username_enc = crypto_utils.encrypt_field(g.vault_key, data["username"])
        if "password" in data:
            if not data["password"]:
                return jsonify({"error": "password cannot be empty."}), 400
            entry.password_enc = crypto_utils.encrypt_field(g.vault_key, data["password"])
        if "notes" in data:
            entry.notes_enc = crypto_utils.encrypt_field(g.vault_key, data["notes"])

        db.session.commit()
        return jsonify(serialize_entry(entry, g.vault_key))

    @app.delete("/api/vault/<int:entry_id>")
    @vault_key_required
    def delete_entry(entry_id):
        entry = VaultEntry.query.filter_by(id=entry_id, user_id=g.user_id).first_or_404()
        db.session.delete(entry)
        db.session.commit()
        return "", 204

    # ------------------------------------------------------------------
    # Utility: secure password generator (no auth needed, no secrets used)
    # ------------------------------------------------------------------
    @app.post("/api/generate-password")
    def generate_password_route():
        data = request.get_json(silent=True) or {}
        pwd = crypto_utils.generate_password(
            length=int(data.get("length", 20)),
            use_upper=bool(data.get("use_upper", True)),
            use_lower=bool(data.get("use_lower", True)),
            use_digits=bool(data.get("use_digits", True)),
            use_symbols=bool(data.get("use_symbols", True)),
            avoid_ambiguous=bool(data.get("avoid_ambiguous", True)),
        )
        return jsonify({"password": pwd})


def serialize_entry(entry: VaultEntry, vault_key: bytes) -> dict:
    return {
        "id": entry.id,
        "site_name": entry.site_name,
        "site_url": entry.site_url,
        "username": crypto_utils.decrypt_field(vault_key, entry.username_enc),
        "password": crypto_utils.decrypt_field(vault_key, entry.password_enc),
        "notes": crypto_utils.decrypt_field(vault_key, entry.notes_enc),
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found."}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error."}), 500


app = create_app()

if __name__ == "__main__":
    app.run(debug=False, port=5000)
