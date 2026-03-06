#!/bin/sh
set -eu

SCRIPT_URL="https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install_and_update.py"

SCRIPT_DIR=""
case "$0" in
  */*)
    SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" 2>/dev/null && pwd || true)
    ;;
esac

LOCAL_SCRIPT=""
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/install_and_update.py" ]; then
  LOCAL_SCRIPT="$SCRIPT_DIR/install_and_update.py"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required to run the installer." >&2
  exit 1
fi

if [ -n "$LOCAL_SCRIPT" ]; then
  python3 "$LOCAL_SCRIPT" "$@"
  exit $?
fi

if command -v curl >/dev/null 2>&1; then
  FETCH_CMD="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH_CMD="wget -qO-"
else
  echo "error: curl or wget is required to download the installer." >&2
  exit 1
fi

TMP_FILE="$(mktemp -t academic-research-skills.XXXXXX.py)"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT INT TERM

sh -c "$FETCH_CMD \"$SCRIPT_URL\" > \"$TMP_FILE\""
python3 "$TMP_FILE" "$@"
