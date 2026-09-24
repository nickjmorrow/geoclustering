#!/usr/bin/env bash
#
# Every check this repo knows how to run, in one place.
#
# Three callers, one script, on purpose: you run it by hand, `.githooks/pre-commit`
# runs it on the halves you touched, and `.github/workflows/ci.yml` runs it in
# CI. A pre-commit hook that checks something different from CI is worse than
# no hook — it teaches you to trust a green that does not mean anything.
#
#   scripts/check.sh                 everything
#   scripts/check.sh backend         backend only
#   scripts/check.sh frontend        frontend only
#   scripts/check.sh --fast          skip the slow parts (see below)
#
# --fast drops the frontend's production build, which is slow and re-proves
# what the typecheck just proved. The hook uses it; CI does not.
#
# No .NET SDK on this machine? The backend checks run inside the SDK's Docker
# image instead, with the same commands, so a frontend-only contributor can
# still run everything.
#
# Failures are collected rather than fatal: one run tells you everything that
# is wrong, not the first thing.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAST=0
TARGET=all
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    backend | frontend | all) TARGET="$arg" ;;
    *)
      echo "usage: scripts/check.sh [backend|frontend|all] [--fast]" >&2
      exit 2
      ;;
  esac
done

FAILED=()
STEP_INDEX=0

step() {
  local name="$1"
  shift
  STEP_INDEX=$((STEP_INDEX + 1))
  printf '\n\033[1m── %s\033[0m\n' "$name"
  if "$@"; then
    return 0
  fi
  FAILED+=("$name")
  return 1
}

note() { printf '\033[2m   %s\033[0m\n' "$1"; }

# --------------------------------------------------------------- toolchains

SDK_IMAGE="mcr.microsoft.com/dotnet/sdk:10.0-alpine"

dotnet_cmd() {
  if command -v dotnet >/dev/null 2>&1; then
    dotnet "$@"
  elif command -v docker >/dev/null 2>&1; then
    # A named volume for the NuGet cache, so the second run doesn't download
    # every package again.
    docker run --rm -v "$ROOT/backend:/src" -v geoclustering-nuget:/root/.nuget/packages \
      -w /src "$SDK_IMAGE" dotnet "$@"
  else
    echo "Neither dotnet nor docker found. Install the .NET 10 SDK: https://dot.net" >&2
    return 127
  fi
}

# pnpm, however this machine has it. `corepack pnpm` reads `packageManager`
# in frontend/package.json, so it is the same pnpm the Dockerfile and CI use.
pnpm_cmd() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  else
    echo "pnpm not found. Install Node 24+ (corepack ships with it) or pnpm itself." >&2
    return 127
  fi
}

# ----------------------------------------------------------------- backend

check_backend() {
  cd "$ROOT/backend" || return
  if ! command -v dotnet >/dev/null 2>&1; then
    note "no dotnet on PATH — running the backend checks in $SDK_IMAGE"
  fi

  # `format` checks whitespace, style and analyzer rules against
  # .editorconfig; `build` treats every warning as an error
  # (Directory.Build.props); `test` runs the unit and API tests, which need
  # nothing running — no database, no network.
  step "backend · format" dotnet_cmd format Geoclustering.slnx --verify-no-changes
  step "backend · build" dotnet_cmd build Geoclustering.slnx
  step "backend · tests" dotnet_cmd test --solution Geoclustering.slnx --no-build

  cd "$ROOT" || return
}

# ---------------------------------------------------------------- frontend

check_frontend() {
  cd "$ROOT/frontend" || return

  if [ ! -d node_modules ]; then
    note "node_modules missing — installing"
    pnpm_cmd install --frozen-lockfile || {
      FAILED+=("frontend (install)")
      cd "$ROOT" || return
      return
    }
  fi

  step "frontend · lint" pnpm_cmd lint
  step "frontend · format" pnpm_cmd format:check
  step "frontend · types" pnpm_cmd typecheck
  step "frontend · tests" pnpm_cmd test

  if [ "$FAST" = "1" ]; then
    note "skipping the production build (--fast)"
  else
    step "frontend · build" pnpm_cmd build
  fi

  cd "$ROOT" || return
}

# --------------------------------------------------------------------- run

if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then check_backend; fi
if [ "$TARGET" = "all" ] || [ "$TARGET" = "frontend" ]; then check_frontend; fi

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  printf '\033[32m✔ all checks passed\033[0m (%s steps)\n' "$STEP_INDEX"
  exit 0
fi

printf '\033[31m✘ %s of %s checks failed:\033[0m\n' "${#FAILED[@]}" "$STEP_INDEX"
printf '   %s\n' "${FAILED[@]}"
exit 1
