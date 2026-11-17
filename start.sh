#!/usr/bin/env sh
# Run from any folder; a Python HTTP server only serves frontend static files.
cd "$(dirname "$0")" || exit 1
python3 -m http.server 8000
