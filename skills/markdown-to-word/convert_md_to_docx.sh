#!/bin/bash
# Convert Markdown to Word (.docx) via Node.js.
# Usage: convert_md_to_docx.sh [-o output.docx] input.md
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-install deps if needed
if [ ! -d "$script_dir/node_modules" ]; then
  echo "Installing dependencies..." >&2
  (cd "$script_dir" && npm install --silent)
fi

exec node "$script_dir/md2docx.mjs" "$@"
