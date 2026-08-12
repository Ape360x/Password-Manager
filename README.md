# Keyseat &mdash; a from-scratch password manager

A full-stack password manager built to demonstrate applied application
security: authenticated encryption, correct key derivation, and a
key-management design that keeps the server from ever holding a usable
copy of your secrets at rest.

**Stack:** Flask + SQLAlchemy + JWT (backend) / React + Vite + Tailwind (frontend)

---

## Why this design (talking points for interviews)

Most "password manager" tutorials just AES-encrypt fields with one static
key baked into the source. This project instead follows the pattern real
password managers (Bitwarden, 1Password) use:

| Concept | What it protects against | Where it lives |
|---|---|---|
| **Argon2id** hash of the master password | Cracking stolen password hashes | `auth_hash` column, used only to verify logins |
| **PBKDF2-HMAC-SHA256** (600k iterations) derives a *master key* from the master password + a random salt | Same as above, independently of the auth hash | Never stored &mdash; recomputed on every login |
| Random 256-bit **vault key** per user, generated once | Lets each user's data be re-keyed/rotated independently | Stored **encrypted** ("wrapped") under the master key |
| **AES-256-GCM** for every secret field (password, username, notes), fresh nonce per write | Confidentiality + tamper detection (authenticated encryption) | `vault_entries` table, ciphertext only |
| Vault key **re-wrapped** under a server secret and embedded in a signed, short-lived **JWT** | Lets the server serve requests after login without ever storing the master password | Client's `Authorization` header only, expires in 20 min |
| Login **rate limiting / lockout** after 5 failed attempts | Online brute-force guessing | `failed_login_attempts` / `locked_until` columns |
| Constant-shape error responses + dummy hashing on unknown usernames | Username enumeration | `login()` route |

**Threat model, honestly stated:** a full database dump alone reveals
nothing usable, since every secret is encrypted under a key that only
exists transiently, derived from a master password nobody stored. What
this design does *not* defend against: a compromised server process
reading a live JWT/vault key out of memory during a request, or a
malicious/compromised frontend exfiltrating plaintext after decryption.
Fully closing that gap requires *client-side* (zero-knowledge)
encryption, where the browser derives the key and the server only ever
sees ciphertext &mdash; a natural "v2" to mention if asked how you'd
extend this.

---

## Project layout

```
password-manager/
├── backend/              Flask API
│   ├── app.py            Routes
│   ├── crypto_utils.py   All crypto in one auditable module
│   ├── auth.py           JWT issuing + vault-key-unwrap decorator
│   ├── models.py         SQLAlchemy models
│   ├── config.py         Env-driven config
│   └── requirements.txt
└── frontend/             React + Vite + Tailwind SPA
    └── src/
        ├── pages/         Login, Register, Dashboard
        ├── components/    Vault cards, entry modal, password generator, dial brand mark
        └── context/       Auth state
```

---

## Running it locally

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Generate real secrets and paste them into .env:
python -c "import secrets; print(secrets.token_urlsafe(32))"                       # SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"                       # JWT_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # KEY_WRAP_SECRET

python app.py     # serves http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # serves http://localhost:5173 and proxies /api to :5000
```

Open http://localhost:5173, create a vault (this is a real master
password with real consequences &mdash; there is no recovery flow, by
design, since the server can't decrypt your data without it), and start
adding entries.

---

## API summary

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/register` | &mdash; | Creates a user, returns a JWT |
| POST | `/api/login` | &mdash; | Verifies Argon2id hash, returns a JWT |
| GET | `/api/me` | JWT | Current user + entry count |
| GET | `/api/vault` | JWT | List + decrypt all entries |
| POST | `/api/vault` | JWT | Create an entry (fields encrypted before storing) |
| PUT | `/api/vault/<id>` | JWT | Update an entry |
| DELETE | `/api/vault/<id>` | JWT | Delete an entry |
| POST | `/api/generate-password` | &mdash; | Cryptographically secure password generator (`secrets` module) |

---

## Ideas for extending this (good resume bullet points if you build them)

- Move to **client-side encryption** so the server only ever sees ciphertext (true zero-knowledge).
- Swap the JWT-in-sessionStorage pattern for an **httpOnly, Secure, SameSite=strict cookie**.
- Add **TOTP-based 2FA** as a second authentication factor.
- Add **audit logging** of login attempts and vault access.
- Add **password breach checking** via the k-anonymity HaveIBeenPwned API.
- Containerize with Docker Compose and add CI (lint + the crypto unit tests you write).

---

## Disclaimer

This project is built to demonstrate and practice real security
engineering concepts for a portfolio/resume. It has not been through a
professional security audit or penetration test; treat it as a learning
project rather than something to store real, high-value passwords in
without further hardening (see the "extending this" section above).
