#!/bin/sh
set -eu

REPO_NAME="academic-research-skills"
REPO_ARCHIVE_URL="https://github.com/WEN-JY/academic-research-skills/archive/refs/heads/main.tar.gz"
SKILLS_START="<!-- SKILLS:START -->"
SKILLS_END="<!-- SKILLS:END -->"
SKILLS_DIR_NAME="skills"
ARCHIVE_URL_ENV="ACADEMIC_RESEARCH_SKILLS_ARCHIVE_URL"
CACHE_DIR_ENV="ACADEMIC_RESEARCH_SKILLS_CACHE_DIR"

usage() {
  cat <<'EOF'
Install skills and update documentation.

Usage:
  sh scripts/install_and_update.sh [options]

Options:
  --dest PATH         Skill install directory. Default: $CODEX_HOME/skills or ~/.codex/skills
  --mode MODE         Install mode: symlink (default) or copy
  --docs-only         Only update docs, skip installation
  --install-only      Only install skills, skip doc updates
  --source-root PATH  Optional local repo root used as the skill source
  -h, --help          Show this help message
EOF
}

default_install_dir() {
  if [ -n "${CODEX_HOME:-}" ]; then
    printf '%s\n' "$CODEX_HOME/skills"
    return
  fi
  printf '%s\n' "$HOME/.codex/skills"
}

default_cache_dir() {
  if [ -n "${ACADEMIC_RESEARCH_SKILLS_CACHE_DIR:-}" ]; then
    printf '%s\n' "$ACADEMIC_RESEARCH_SKILLS_CACHE_DIR"
    return
  fi
  if [ -n "${CODEX_HOME:-}" ]; then
    printf '%s\n' "$CODEX_HOME/.cache/$REPO_NAME"
    return
  fi
  printf '%s\n' "$HOME/.codex/.cache/$REPO_NAME"
}

ensure_dir() {
  mkdir -p "$1"
}

canonical_path() {
  target=$1
  if [ -d "$target" ]; then
    (
      cd "$target"
      pwd -P
    )
    return
  fi

  parent=$(dirname "$target")
  base=$(basename "$target")
  parent_abs=$(
    cd "$parent"
    pwd -P
  )
  printf '%s/%s\n' "$parent_abs" "$base"
}

backup_existing() {
  target=$1
  timestamp=$(date '+%Y%m%d%H%M%S')
  backup="${target}.bak-${timestamp}"
  mv "$target" "$backup"
  printf '%s\n' "$backup"
}

make_temp_file() {
  mktemp "${TMPDIR:-/tmp}/academic-research-skills.XXXXXX"
}

make_temp_dir() {
  mktemp -d "${TMPDIR:-/tmp}/academic-research-skills.XXXXXX"
}

download_to_file() {
  url=$1
  dest=$2

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO "$dest" "$url"
    return
  fi

  echo "error: curl or wget is required to download the installer." >&2
  exit 1
}

collect_skill_names() {
  base_dir=$1
  if [ ! -d "$base_dir" ]; then
    return
  fi

  find "$base_dir" -mindepth 1 -maxdepth 1 -type d | while IFS= read -r skill_dir; do
    if [ -f "$skill_dir/SKILL.md" ]; then
      basename "$skill_dir"
    fi
  done
}

discover_skill_names() {
  root=$1
  tmp_file=$(make_temp_file)
  trap 'rm -f "$tmp_file"' EXIT INT TERM HUP

  if [ -d "$root/$SKILLS_DIR_NAME" ]; then
    collect_skill_names "$root/$SKILLS_DIR_NAME" >>"$tmp_file"
  fi

  find "$root" -mindepth 1 -maxdepth 1 -type d | while IFS= read -r skill_dir; do
    name=$(basename "$skill_dir")
    case "$name" in
      .git|.claude|docs|scripts|"$SKILLS_DIR_NAME")
        continue
        ;;
    esac
    if [ -f "$skill_dir/SKILL.md" ]; then
      printf '%s\n' "$name"
    fi
  done >>"$tmp_file"

  sort -u "$tmp_file"
  rm -f "$tmp_file"
  trap - EXIT INT TERM HUP
}

skill_dir_for_name() {
  root=$1
  name=$2
  if [ -f "$root/$SKILLS_DIR_NAME/$name/SKILL.md" ]; then
    printf '%s\n' "$root/$SKILLS_DIR_NAME/$name"
    return
  fi
  printf '%s\n' "$root/$name"
}

has_skills() {
  root=$1
  skills=$(discover_skill_names "$root")
  [ -n "$skills" ]
}

is_repo_root() {
  root=$1
  if [ ! -d "$root" ]; then
    return 1
  fi
  if [ ! -f "$root/scripts/install_and_update.sh" ]; then
    return 1
  fi
  has_skills "$root"
}

parse_skill_field() {
  skill_file=$1
  field=$2

  awk -v wanted="$field" '
    NR == 1 {
      if ($0 != "---") {
        exit
      }
      in_front = 1
      next
    }
    in_front && $0 == "---" {
      exit
    }
    in_front && $0 ~ ("^" wanted ":[[:space:]]*") {
      sub("^" wanted ":[[:space:]]*", "", $0)
      gsub(/^"/, "", $0)
      gsub(/"$/, "", $0)
      gsub(/^'\''/, "", $0)
      gsub(/'\''$/, "", $0)
      print
      exit
    }
  ' "$skill_file"
}

build_skill_block() {
  root=$1
  lang=$2
  output=$3

  : >"$output"
  discover_skill_names "$root" | while IFS= read -r name; do
    [ -n "$name" ] || continue
    skill_dir=$(skill_dir_for_name "$root" "$name")
    skill_file="$skill_dir/SKILL.md"
    desc=""
    if [ "$lang" = "zh" ]; then
      desc=$(parse_skill_field "$skill_file" "description_zh")
      if [ -z "$desc" ]; then
        desc=$(parse_skill_field "$skill_file" "description")
      fi
    else
      desc=$(parse_skill_field "$skill_file" "description")
      if [ -z "$desc" ]; then
        desc=$(parse_skill_field "$skill_file" "description_zh")
      fi
    fi

    if [ -n "$desc" ]; then
      printf -- '- `%s` - %s\n' "$name" "$desc" >>"$output"
    else
      printf -- '- `%s`\n' "$name" >>"$output"
    fi
  done
}

update_doc() {
  path=$1
  block_file=$2

  if [ ! -f "$path" ]; then
    return
  fi

  tmp_file=$(make_temp_file)
  awk -v start="$SKILLS_START" -v end="$SKILLS_END" -v block_file="$block_file" '
    BEGIN {
      while ((getline line < block_file) > 0) {
        block = block line ORS
      }
      close(block_file)
    }
    {
      if ($0 == start) {
        found = 1
        in_block = 1
        print
        printf "%s", block
        next
      }
      if (in_block) {
        if ($0 == end) {
          print
          in_block = 0
        }
        next
      }
      print
    }
    END {
      if (!found) {
        if (NR > 0) {
          print ""
        }
        print start
        printf "%s", block
        print end
      }
    }
  ' "$path" >"$tmp_file"
  mv "$tmp_file" "$path"
}

ensure_skill_docs() {
  root=$1
  docs_skills_dir="$root/docs/skills"
  ensure_dir "$docs_skills_dir"

  discover_skill_names "$root" | while IFS= read -r name; do
    [ -n "$name" ] || continue

    zh_target="$docs_skills_dir/$name.md"
    en_target="$docs_skills_dir/$name.en.md"

    if [ ! -f "$zh_target" ]; then
      cat >"$zh_target" <<EOF
# $name

该技能文档尚未补充，请参考对应的 SKILL.md。
EOF
      printf 'created doc stub: %s\n' "$zh_target"
    fi

    if [ ! -f "$en_target" ]; then
      cat >"$en_target" <<EOF
# $name

Documentation pending. Refer to the corresponding SKILL.md.
EOF
      printf 'created doc stub: %s\n' "$en_target"
    fi
  done
}

update_repo_docs() {
  root=$1
  zh_block=$(make_temp_file)
  en_block=$(make_temp_file)

  build_skill_block "$root" "zh" "$zh_block"
  build_skill_block "$root" "en" "$en_block"

  update_doc "$root/README.md" "$zh_block"
  update_doc "$root/docs/README.md" "$zh_block"
  update_doc "$root/README.en.md" "$en_block"
  update_doc "$root/docs/README.en.md" "$en_block"
  ensure_skill_docs "$root"

  rm -f "$zh_block" "$en_block"
}

bootstrap_repo_snapshot() {
  cache_dir=$(default_cache_dir)
  archive_url=${ACADEMIC_RESEARCH_SKILLS_ARCHIVE_URL:-$REPO_ARCHIVE_URL}
  repo_dir="$cache_dir/repo"
  tmp_dir=""
  archive_path=""
  extract_dir=""

  ensure_dir "$cache_dir"
  tmp_dir=$(mktemp -d "$cache_dir/${REPO_NAME}.XXXXXX")
  archive_path="$tmp_dir/repo.tar.gz"
  extract_dir="$tmp_dir/extract"
  ensure_dir "$extract_dir"

  cleanup() {
    if [ -n "$tmp_dir" ] && [ -d "$tmp_dir" ]; then
      rm -rf "$tmp_dir"
    fi
  }
  trap cleanup EXIT INT TERM HUP

  download_to_file "$archive_url" "$archive_path"
  tar -xzf "$archive_path" -C "$extract_dir"

  extracted_count=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  if [ "$extracted_count" != "1" ]; then
    echo "Failed to prepare skill source: unexpected archive layout from $archive_url" >&2
    exit 1
  fi
  extracted_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)

  if [ -e "$repo_dir" ] || [ -L "$repo_dir" ]; then
    rm -rf "$repo_dir"
  fi
  mv "$extracted_root" "$repo_dir"

  trap - EXIT INT TERM HUP
  cleanup
  printf '%s\n' "$repo_dir"
}

resolve_repo_root() {
  source_root=$1

  if [ -n "$source_root" ]; then
    source_root=$(canonical_path "$source_root")
    if ! is_repo_root "$source_root"; then
      echo "Failed to prepare skill source: invalid --source-root: $source_root" >&2
      exit 1
    fi
    printf '%s\n' "$source_root"
    return
  fi

  script_dir=""
  case "$0" in
    */*)
      script_dir=$(
        CDPATH='' cd -- "$(dirname -- "$0")" 2>/dev/null &&
          pwd -P
      )
      ;;
  esac

  if [ -n "$script_dir" ]; then
    candidate=$(canonical_path "$script_dir/..")
    if is_repo_root "$candidate"; then
      printf '%s\n' "$candidate"
      return
    fi
  fi

  bootstrap_repo_snapshot
}

install_skill() {
  src=$1
  dest_root=$2
  mode=$3

  name=$(basename "$src")
  dest="$dest_root/$name"

  if [ -L "$dest" ]; then
    current_target=$(readlink "$dest" || true)
    if [ "$current_target" = "$src" ]; then
      printf 'skipped: %s -> %s\n' "$name" "$dest"
      return
    fi
    backup_existing "$dest" >/dev/null
  elif [ -e "$dest" ]; then
    backup_existing "$dest" >/dev/null
  fi

  if [ "$mode" = "symlink" ]; then
    ln -s "$src" "$dest"
  else
    cp -R "$src" "$dest"
  fi
  printf 'installed: %s -> %s\n' "$name" "$dest"
}

DEST=$(default_install_dir)
MODE="symlink"
DOCS_ONLY=0
INSTALL_ONLY=0
SOURCE_ROOT=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dest)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --dest." >&2
        exit 2
      fi
      DEST=$1
      ;;
    --mode)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --mode." >&2
        exit 2
      fi
      MODE=$1
      ;;
    --docs-only)
      DOCS_ONLY=1
      ;;
    --install-only)
      INSTALL_ONLY=1
      ;;
    --source-root)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --source-root." >&2
        exit 2
      fi
      SOURCE_ROOT=$1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [ "$DOCS_ONLY" -eq 1 ] && [ "$INSTALL_ONLY" -eq 1 ]; then
  echo "--docs-only and --install-only cannot be used together." >&2
  exit 2
fi

case "$MODE" in
  symlink|copy)
    ;;
  *)
    echo "Invalid --mode: $MODE" >&2
    exit 2
    ;;
esac

ROOT=$(resolve_repo_root "$SOURCE_ROOT")
SKILLS=$(discover_skill_names "$ROOT")

if [ -z "$SKILLS" ]; then
  echo "No skills found in $ROOT." >&2
  exit 1
fi

if [ "$DOCS_ONLY" -eq 0 ]; then
  ensure_dir "$DEST"
  printf '%s\n' "$SKILLS" | while IFS= read -r name; do
    [ -n "$name" ] || continue
    install_skill "$(skill_dir_for_name "$ROOT" "$name")" "$DEST" "$MODE"
  done
fi

if [ "$INSTALL_ONLY" -eq 0 ]; then
  update_repo_docs "$ROOT"
fi
