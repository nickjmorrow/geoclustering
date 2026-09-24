#!/usr/bin/env bash
#
# Once per clone: frontend dependencies, backend packages, and the pre-commit
# hook. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "── pre-commit hook"
git config core.hooksPath .githooks
echo "   core.hooksPath = .githooks"

echo "── frontend dependencies"
(cd frontend && { command -v pnpm >/dev/null && pnpm install || corepack pnpm install; })

echo "── backend packages"
if command -v dotnet >/dev/null; then
  (cd backend && dotnet restore Geoclustering.slnx)
else
  echo "   no dotnet on PATH; scripts/check.sh will run the backend in Docker instead."
  echo "   To work on it natively, install the .NET 10 SDK: https://dot.net"
fi

echo
echo "Done. Start everything with: docker compose up"
