from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)

    # Argon2id hash used ONLY to verify login attempts.
    auth_hash = db.Column(db.String(255), nullable=False)

    # Salt used to derive the master key from the master password (PBKDF2).
    kdf_salt = db.Column(db.LargeBinary(16), nullable=False)
    kdf_iterations = db.Column(db.Integer, nullable=False)

    # The random per-user vault key, encrypted ("wrapped") under the
    # master key. Useless without the master password.
    wrapped_vault_key = db.Column(db.String(255), nullable=False)

    created_at = db.Column(db.DateTime, default=utcnow)
    failed_login_attempts = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)

    entries = db.relationship(
        "VaultEntry", backref="owner", cascade="all, delete-orphan", lazy=True
    )


class VaultEntry(db.Model):
    __tablename__ = "vault_entries"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Site name/URL are kept in plaintext to allow search/sort in the UI.
    # Everything actually secret is encrypted below.
    site_name = db.Column(db.String(120), nullable=False)
    site_url = db.Column(db.String(255), nullable=True)

    username_enc = db.Column(db.Text, nullable=True)
    password_enc = db.Column(db.Text, nullable=False)
    notes_enc = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
