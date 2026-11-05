#!/usr/bin/env bash
# Export the deck from SQLite to $PERDISCO_DATA/flashcards.json, commit it
# (plus any new images in assets/) in the data repo, and push.
#   tools/snapshot.sh            export + commit + push
#   tools/snapshot.sh --no-push  export + commit only
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$REPO/local.env" ]; then set -a; . "$REPO/local.env"; set +a; fi
DATA="${PERDISCO_DATA:?set PERDISCO_DATA (e.g. in local.env) to your private data repo}"
DATA="${DATA/#\~/$HOME}"
DATA_TOP="$(git -C "$DATA" rev-parse --show-toplevel 2>/dev/null)" || { echo "$DATA is not a git repo" >&2; exit 1; }
if [ "$DATA_TOP" = "$(git -C "$REPO" rev-parse --show-toplevel)" ]; then
  echo "PERDISCO_DATA points inside the app repo; use a separate (private) data repo" >&2
  exit 1
fi

PY="$REPO/.venv/bin/python3"; [ -x "$PY" ] || PY=python3
PERDISCO_DATA="$DATA" "$PY" "$REPO/src/store.py" export >/dev/null

cd "$DATA"
git add flashcards.json
[ -d assets ] && git add assets
if git diff --cached --quiet; then
  echo "No changes since the last snapshot."
  exit 0
fi
git commit -q -m "Deck snapshot $(date '+%Y-%m-%d %H:%M')"
[ "${1:-}" = "--no-push" ] || git push -q
git log --oneline -1
