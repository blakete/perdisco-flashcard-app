#!/bin/bash
# local.env (not committed) can set PERDISCO_DATA=/path/to/your/private/data/repo
cd "$(dirname "$0")"
if [ -f local.env ]; then set -a; . ./local.env; set +a; fi
cd src
../.venv/bin/python3 flashcards.py
