"""
All cryptographic operations for the password manager live in this one
module, so the "trusted computing base" for crypto is easy to audit.

Design (modelled on how Bitwarden / 1Password think about this problem):

1.  The user's master password NEVER touches disk, in any form that could
    be reversed back into the password.

2.  Two independent things are derived from the master password:
      - an *authentication* check (Argon2id hash) used only to verify
        login attempts.
      - a *master key* (PBKDF2-HMAC-SHA256) used only to encrypt/decrypt
        the user's random vault key. It is derived fresh on every login
        and is never stored.

3.  Each user has a random 256-bit *vault key*, generated once at
    registration. It is what actually encrypts/decrypts vault entries.
    It is stored ("wrapped") encrypted under the master key, so even a
    full database dump is useless without the master password.

4.  Individual vault fields (password, notes, etc.) are encrypted with
    AES-256-GCM, using a fresh random 96-bit nonce per field per write.
    GCM gives us confidentiality + integrity (tampering is detected).

5.  Between requests, the server cannot hold the master password. Instead,
    after a successful login the vault key is *re-wrapped* under a
    server-side secret (KEY_WRAP_SECRET) and embedded inside the signed
    JWT that the browser holds. The server can unwrap it to service
    requests; an attacker with only the database (no JWT, no server
    secret) cannot.
"""
import base64
import os
import secrets
import string

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_ph = PasswordHasher()  # sane, modern defaults (Argon2id)

AES_KEY_LEN = 32   # 256-bit
NONCE_LEN = 12     # 96-bit, standard for AES-GCM


# --------------------------------------------------------------------------
# Login authentication (Argon2id) — completely separate from encryption
# --------------------------------------------------------------------------
def hash_password(master_password: str) -> str:
    return _ph.hash(master_password)


def verify_password(stored_hash: str, master_password: str) -> bool:
    try:
        return _ph.verify(stored_hash, master_password)
    except (VerifyMismatchError, InvalidHash):
        return False


def needs_rehash(stored_hash: str) -> bool:
    return _ph.check_needs_rehash(stored_hash)


# --------------------------------------------------------------------------
# Master key derivation (PBKDF2-HMAC-SHA256)
# --------------------------------------------------------------------------
def generate_salt() -> bytes:
    return os.urandom(16)


def derive_master_key(master_password: str, salt: bytes, iterations: int) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=AES_KEY_LEN,
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(master_password.encode("utf-8"))


# --------------------------------------------------------------------------
# Generic AES-256-GCM helpers (used both for wrapping the vault key and
# for encrypting individual vault fields)
# --------------------------------------------------------------------------
def aes_encrypt(key: bytes, plaintext: bytes, associated_data: bytes = b"") -> str:
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_LEN)
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def aes_decrypt(key: bytes, blob_b64: str, associated_data: bytes = b"") -> bytes:
    raw = base64.urlsafe_b64decode(blob_b64.encode("ascii"))
    nonce, ciphertext = raw[:NONCE_LEN], raw[NONCE_LEN:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, associated_data)


# --------------------------------------------------------------------------
# Vault key generation / wrapping under the master key (stored in DB)
# --------------------------------------------------------------------------
def generate_vault_key() -> bytes:
    return os.urandom(AES_KEY_LEN)


def wrap_vault_key_with_master_key(vault_key: bytes, master_key: bytes) -> str:
    return aes_encrypt(master_key, vault_key, associated_data=b"vault-key")


def unwrap_vault_key_with_master_key(blob_b64: str, master_key: bytes) -> bytes:
    return aes_decrypt(master_key, blob_b64, associated_data=b"vault-key")


# --------------------------------------------------------------------------
# Re-wrapping the vault key under the server secret so it can safely live
# inside a signed JWT for the duration of a session.
# --------------------------------------------------------------------------
def _fernet(server_secret: str) -> Fernet:
    return Fernet(server_secret.encode("ascii"))


def wrap_vault_key_for_session(vault_key: bytes, server_secret: str) -> str:
    return _fernet(server_secret).encrypt(vault_key).decode("ascii")


def unwrap_vault_key_from_session(token: str, server_secret: str) -> bytes:
    try:
        return _fernet(server_secret).decrypt(token.encode("ascii"))
    except InvalidToken:
        raise ValueError("Session key could not be unwrapped")


# --------------------------------------------------------------------------
# Field-level encryption for vault entries
# --------------------------------------------------------------------------
def encrypt_field(vault_key: bytes, plaintext: str) -> str:
    if plaintext is None:
        return ""
    return aes_encrypt(vault_key, plaintext.encode("utf-8"))


def decrypt_field(vault_key: bytes, blob_b64: str) -> str:
    if not blob_b64:
        return ""
    return aes_decrypt(vault_key, blob_b64).decode("utf-8")


# --------------------------------------------------------------------------
# Password generator (cryptographically secure, via `secrets`)
# --------------------------------------------------------------------------
AMBIGUOUS = set("Il1O0")


def generate_password(length: int = 20, use_upper: bool = True, use_lower: bool = True,
                       use_digits: bool = True, use_symbols: bool = True,
                       avoid_ambiguous: bool = True) -> str:
    length = max(8, min(length, 128))
    pools = []
    if use_lower:
        pools.append(string.ascii_lowercase)
    if use_upper:
        pools.append(string.ascii_uppercase)
    if use_digits:
        pools.append(string.digits)
    if use_symbols:
        pools.append("!@#$%^&*()-_=+[]{}?")
    if not pools:
        pools = [string.ascii_lowercase]

    alphabet = "".join(pools)
    if avoid_ambiguous:
        alphabet = "".join(c for c in alphabet if c not in AMBIGUOUS)

    # Guarantee at least one char from each requested pool, then fill the
    # rest randomly, then shuffle — this keeps it unpredictable while
    # satisfying the composition requirements.
    result = []
    for pool in pools:
        cleaned = "".join(c for c in pool if not avoid_ambiguous or c not in AMBIGUOUS)
        if cleaned:
            result.append(secrets.choice(cleaned))
    while len(result) < length:
        result.append(secrets.choice(alphabet))

    secrets.SystemRandom().shuffle(result)
    return "".join(result[:length])
