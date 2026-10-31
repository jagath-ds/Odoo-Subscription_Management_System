#!/usr/bin/env bash
# BrightLoop Subscription ERP - one-command full-stack setup (macOS / Linux / Git Bash).
#
# Run from the repository root:
#     ./setup.sh             full setup
#     ./setup.sh --skip-db   install everything except the database step
#
# Steps: check prerequisites -> create venv + pip install -r requirements.txt
#        -> copy .env.example files -> create PostgreSQL database + seed demo data
#        -> npm install in frontend/.
# Safe to re-run: an existing venv, .env files and database data are kept.
set -euo pipefail
cd "$(dirname "$0")"

SKIP_DB=0
if [ "${1:-}" = "--skip-db" ]; then SKIP_DB=1; fi

step() { printf '\033[36m[%s/5] %s\033[0m\n' "$1" "$2"; }
fail() { printf '\033[31m[ERROR] %s\033[0m\n' "$1"; exit 1; }

echo
echo "=================================================="
echo " BrightLoop Subscription ERP - full-stack setup"
echo "=================================================="
echo

# 1. Prerequisites -----------------------------------------------------------------
step 1 "Checking prerequisites..."
PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 &&
     "$candidate" -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then fail "Python 3.11+ was not found on PATH (https://www.python.org/downloads/)."; fi
if ! command -v node >/dev/null 2>&1; then fail "Node.js 22 LTS was not found on PATH (https://nodejs.org)."; fi
echo "      $("$PYTHON" --version)   Node $(node -v)"

# 2. Python virtual environment -------------------------------------------------------
step 2 "Creating the virtual environment (venv) and installing requirements.txt..."
if [ ! -d venv ]; then "$PYTHON" -m venv venv; fi
if [ -x venv/bin/python ]; then VENV_PY="venv/bin/python"; else VENV_PY="venv/Scripts/python"; fi
"$VENV_PY" -m pip install --upgrade pip --quiet --disable-pip-version-check
"$VENV_PY" -m pip install -r requirements.txt --quiet --disable-pip-version-check || fail "pip install -r requirements.txt failed."

# 3. Environment files ----------------------------------------------------------------
step 3 "Preparing .env files..."
if [ ! -f .env ]; then
  cp .env.example .env
  # Replace the JWT secret placeholder with a fresh random value.
  "$VENV_PY" -c "import pathlib, secrets; p = pathlib.Path('.env'); p.write_text(p.read_text(encoding='utf-8').replace('replace-with-a-64-character-random-hex-string', secrets.token_hex(32)), encoding='utf-8')"
  echo "      Created .env from .env.example (random JWT_SECRET_KEY generated)."
else
  echo "      .env already exists - keeping it."
fi
if [ ! -f frontend/.env ]; then
  cp frontend/.env.example frontend/.env
  echo "      Created frontend/.env from frontend/.env.example."
else
  echo "      frontend/.env already exists - keeping it."
fi
NEEDS_PASSWORD=0
if grep -q "YOUR_POSTGRES_PASSWORD" .env; then NEEDS_PASSWORD=1; fi

# 4. Database -------------------------------------------------------------------------
if [ "$SKIP_DB" = 1 ]; then
  step 4 "Skipping the database step (--skip-db)."
elif [ "$NEEDS_PASSWORD" = 1 ]; then
  step 4 "Skipping the database step: set your PostgreSQL password first."
  echo "      Open .env, replace YOUR_POSTGRES_PASSWORD in DATABASE_URL, then run ./setup.sh again."
else
  step 4 "Creating the PostgreSQL database and tables, then seeding demo data..."
  "$VENV_PY" scripts/init_db.py || fail "Database initialisation failed. Is PostgreSQL running and is DATABASE_URL in .env correct?"
  "$VENV_PY" -m backend.seed || fail "Seeding demo data failed."
fi

# 5. Frontend dependencies ---------------------------------------------------------------
step 5 "Installing frontend dependencies (npm install)..."
(cd frontend && npm install --no-audit --no-fund) || fail "npm install failed. Check your network/proxy and try again."

cat <<EOF

Setup complete. Start the app in two terminals from the repository root:
  Backend : $VENV_PY -m uvicorn backend.main:app --reload --port 8000
            API http://127.0.0.1:8000   Swagger http://127.0.0.1:8000/docs
  Frontend: cd frontend && npm run dev
            App http://localhost:5173

Demo logins (password Brightloop@123):
  admin@brightloop.local | staff@brightloop.local | customer@brightloop.local
EOF
if [ "$NEEDS_PASSWORD" = 1 ] && [ "$SKIP_DB" = 0 ]; then
  echo
  echo "Reminder: set your PostgreSQL password in .env and re-run ./setup.sh to create the database."
fi
