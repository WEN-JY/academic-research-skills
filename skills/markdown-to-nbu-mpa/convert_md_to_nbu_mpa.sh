#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_CONVERTER="$SCRIPT_DIR/nbu-md2docx.mjs"
PREPROCESSOR="$SCRIPT_DIR/nbu-md-preprocess.mjs"
FORMATTER="$SCRIPT_DIR/nbu-docx-format.mjs"
RULES="$SCRIPT_DIR/rules/ningbo-mpa.json"

usage() {
  cat <<'EOF'
用法：
  skills/markdown-to-nbu-mpa/convert_md_to_nbu_mpa.sh \
    [-o output.docx] \
    [--report report.md] \
    [--json report.json] \
    [--title "论文中文题目"] \
    input.md
EOF
}

output=""
report=""
json=""
title=""
input=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    -o|--out)
      output="${2:-}"
      shift 2
      ;;
    --report)
      report="${2:-}"
      shift 2
      ;;
    --json)
      json="${2:-}"
      shift 2
      ;;
    --title)
      title="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "错误：无法识别参数 $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [ -n "$input" ]; then
        echo "错误：只能提供一个输入 Markdown 文件" >&2
        exit 2
      fi
      input="$1"
      shift
      ;;
  esac
done

if [ -z "$input" ]; then
  usage >&2
  exit 2
fi

if [ ! -f "$input" ]; then
  echo "错误：输入文件不存在：$input" >&2
  exit 1
fi

if [ -z "$title" ]; then
  title="$(
    awk '
      NR == 1 && $0 == "---" { in_yaml = 1; next }
      in_yaml && $0 == "---" { exit }
      in_yaml && $0 ~ /^title:[[:space:]]*/ {
        sub(/^title:[[:space:]]*/, "")
        gsub(/^"/, ""); gsub(/"$/, "")
        gsub(/^'\''/, ""); gsub(/'\''$/, "")
        print
        exit
      }
    ' "$input"
  )"
fi

if [ -z "$title" ]; then
  title="$(
    awk '
      NR == 1 && $0 ~ /^#[[:space:]]+/ && $0 !~ /^#[[:space:]]*第[0-9一二三四五六七八九十]+章/ {
        sub(/^#[[:space:]]+/, "")
        print
        exit
      }
    ' "$input"
  )"
fi

if [ -z "$output" ]; then
  output="${input%.md}.docx"
fi

input_dir="$(cd "$(dirname "$input")" && pwd)"
tmp_stem="$(basename "${input%.md}")"
tmp_root="${TMPDIR:-/tmp}"
tmp_md="$tmp_root/$tmp_stem.nbu-mpa.clean.$$.$RANDOM.md"
tmp_refs="$tmp_root/$tmp_stem.nbu-mpa.refs.$$.$RANDOM.json"
tmp_docx="$tmp_root/$tmp_stem.nbu-mpa.raw.$$.$RANDOM.docx"
cleanup() {
  rm -f "$tmp_md"
  rm -f "$tmp_refs"
  rm -f "$tmp_docx"
}
trap cleanup EXIT

node "$PREPROCESSOR" "$input" "$tmp_md" "$tmp_refs"

PANDOC_RESOURCE_PATH="$input_dir" node "$BASE_CONVERTER" -o "$tmp_docx" "$tmp_md"

format_args=(--rules "$RULES" -o "$output")
if [ -s "$tmp_refs" ]; then
  format_args+=(--references-json "$tmp_refs")
fi
if [ -n "$report" ]; then
  format_args+=(--report "$report")
fi
if [ -n "$json" ]; then
  format_args+=(--json "$json")
fi
if [ -n "$title" ]; then
  format_args+=(--title "$title")
fi
format_args+=("$tmp_docx")

node "$FORMATTER" format "${format_args[@]}"

echo "输出文档：$output"
if [ -n "$report" ]; then
  echo "检查报告：$report"
fi
if [ -n "$json" ]; then
  echo "JSON 报告：$json"
fi
