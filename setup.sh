#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/frontend"

echo
echo "============================================"
echo " Brightloop Subscription Management - setup"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found on PATH."
  echo "        Install Node.js 22 LTS from https://nodejs.org and run this script again."
  exit 1
fi

echo "[1/4] Node.js $(node -v) detected."

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "[2/4] Created frontend/.env from .env.example"
  else
    echo "[2/4] No .env.example found - skipping .env"
  fi
else
  echo "[2/4] frontend/.env already exists - keeping it."
fi

if [ -f package-lock.json ]; then
  echo "[3/4] Installing dependencies with npm ci..."
  npm ci
else
  echo "[3/4] Installing dependencies with npm install..."
  npm install
fi

echo "[4/4] Starting the dev server at http://127.0.0.1:5173 ..."
echo "      Press Ctrl+C to stop."
echo
npm run dev
