#!/usr/bin/env python3
"""Install skills and update documentation.

- Discovers skill folders in `skills/` first, with backward-compatible fallback to repo root.
- Installs skills to $CODEX_HOME/skills or ~/.codex/skills by default.
- Updates README.md and docs/README.md skill lists via markers.
- When executed from a temporary downloaded script, bootstraps a cached repo snapshot.
"""

from __future__ import annotations

import argparse
import os
import shutil
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Dict, List, Tuple

REPO_NAME = "academic-research-skills"
REPO_ARCHIVE_URL = (
    "https://github.com/WEN-JY/academic-research-skills/archive/refs/heads/main.tar.gz"
)
SKILLS_START = "<!-- SKILLS:START -->"
SKILLS_END = "<!-- SKILLS:END -->"
SKILLS_DIR_NAME = "skills"
SKILL_ROOT_EXCLUDES = {".git", ".claude", "docs", "scripts", SKILLS_DIR_NAME}
ARCHIVE_URL_ENV = "ACADEMIC_RESEARCH_SKILLS_ARCHIVE_URL"
CACHE_DIR_ENV = "ACADEMIC_RESEARCH_SKILLS_CACHE_DIR"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install skills and update docs.")
    parser.add_argument(
        "--dest",
        type=Path,
        default=default_install_dir(),
        help="Skill install directory. Default: $CODEX_HOME/skills or ~/.codex/skills",
    )
    parser.add_argument(
        "--mode",
        choices=["symlink", "copy"],
        default="symlink",
        help="Install mode: symlink (default) or copy.",
    )
    parser.add_argument(
        "--docs-only",
        action="store_true",
        help="Only update docs, skip installation.",
    )
    parser.add_argument(
        "--install-only",
        action="store_true",
        help="Only install skills, skip doc updates.",
    )
    parser.add_argument(
        "--source-root",
        type=Path,
        help="Optional local repo root used as the skill source.",
    )
    return parser.parse_args()


def default_install_dir() -> Path:
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home) / "skills"
    return Path.home() / ".codex" / "skills"


def default_cache_dir() -> Path:
    cache_dir = os.environ.get(CACHE_DIR_ENV)
    if cache_dir:
        return Path(cache_dir)
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home) / ".cache" / REPO_NAME
    return Path.home() / ".codex" / ".cache" / REPO_NAME


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def backup_existing(path: Path) -> Path:
    timestamp = time.strftime("%Y%m%d%H%M%S")
    backup = path.with_name(f"{path.name}.bak-{timestamp}")
    path.rename(backup)
    return backup


def collect_skill_dirs(base_dir: Path) -> List[Path]:
    skills = []
    if not base_dir.is_dir():
        return skills
    for item in base_dir.iterdir():
        if item.is_dir() and (item / "SKILL.md").is_file():
            skills.append(item)
    return skills


def discover_skills(root: Path) -> List[Path]:
    skills_by_name = {}

    skills_dir = root / SKILLS_DIR_NAME
    for skill_dir in collect_skill_dirs(skills_dir):
        skills_by_name[skill_dir.name] = skill_dir

    for skill_dir in collect_skill_dirs(root):
        if skill_dir.name in SKILL_ROOT_EXCLUDES:
            continue
        skills_by_name.setdefault(skill_dir.name, skill_dir)

    return sorted(skills_by_name.values(), key=lambda p: p.name)


def is_repo_root(path: Path) -> bool:
    if not path.is_dir():
        return False
    if not (path / "scripts" / "install_and_update.py").is_file():
        return False
    return bool(discover_skills(path))


def parse_skill_meta(skill_dir: Path) -> Dict[str, str]:
    meta = {
        "name": skill_dir.name,
        "description": "",
        "description_zh": "",
    }
    skill_file = skill_dir / "SKILL.md"
    try:
        text = skill_file.read_text(encoding="utf-8")
    except Exception:
        return meta

    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            front = text[3:end].strip().splitlines()
            for line in front:
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                key = key.strip().lower()
                value = value.strip().strip('"')
                if key in meta:
                    meta[key] = value
    return meta


def replace_tree(src: Path, dest: Path) -> None:
    if dest.is_symlink() or dest.is_file():
        dest.unlink()
    elif dest.is_dir():
        shutil.rmtree(dest)
    shutil.move(str(src), str(dest))


def bootstrap_repo_snapshot() -> Path:
    cache_dir = default_cache_dir()
    ensure_dir(cache_dir)
    archive_url = os.environ.get(ARCHIVE_URL_ENV, REPO_ARCHIVE_URL)
    repo_dir = cache_dir / "repo"

    with tempfile.TemporaryDirectory(prefix=f"{REPO_NAME}-", dir=cache_dir) as tmp:
        tmp_dir = Path(tmp)
        archive_path = tmp_dir / "repo.tar.gz"
        extract_dir = tmp_dir / "extract"
        ensure_dir(extract_dir)

        with urllib.request.urlopen(archive_url) as response, archive_path.open("wb") as fh:
            shutil.copyfileobj(response, fh)

        with tarfile.open(archive_path, "r:gz") as tar:
            try:
                tar.extractall(extract_dir, filter="data")
            except TypeError:
                tar.extractall(extract_dir)

        extracted_roots = [item for item in extract_dir.iterdir() if item.is_dir()]
        if len(extracted_roots) != 1:
            raise RuntimeError(f"Unexpected archive layout from {archive_url}")

        replace_tree(extracted_roots[0], repo_dir)

    return repo_dir


def resolve_repo_root(source_root: Path | None) -> Path:
    if source_root is not None:
        source_root = source_root.resolve()
        if not is_repo_root(source_root):
            raise ValueError(f"Invalid --source-root: {source_root}")
        return source_root

    candidate = Path(__file__).resolve().parents[1]
    if is_repo_root(candidate):
        return candidate

    return bootstrap_repo_snapshot()


def install_skill(src: Path, dest_root: Path, mode: str) -> Tuple[str, Path]:
    dest = dest_root / src.name
    if dest.exists() or dest.is_symlink():
        if dest.is_symlink() and dest.resolve() == src.resolve():
            return "skipped", dest
        backup_existing(dest)

    if mode == "symlink":
        dest.symlink_to(src, target_is_directory=True)
    else:
        shutil.copytree(src, dest)
    return "installed", dest


def build_skill_list(skills: List[Path], lang: str) -> str:
    lines = []
    for skill in skills:
        meta = parse_skill_meta(skill)
        if lang == "zh":
            desc = meta.get("description_zh", "").strip()
        else:
            desc = meta.get("description", "").strip()
        suffix = f" - {desc}" if desc else ""
        lines.append(f"- `{meta['name']}`{suffix}")
    return "\n".join(lines)


def replace_block(text: str, start: str, end: str, new_block: str) -> str:
    if start in text and end in text:
        before, rest = text.split(start, 1)
        _, after = rest.split(end, 1)
        return f"{before}{start}\n{new_block}\n{end}{after}"
    return f"{text.rstrip()}\n\n{start}\n{new_block}\n{end}\n"


def update_doc(path: Path, skills_block: str) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    updated = replace_block(text, SKILLS_START, SKILLS_END, skills_block)
    path.write_text(updated, encoding="utf-8")


def ensure_skill_docs(root: Path, skills: List[Path]) -> List[Path]:
    created = []
    docs_skills_dir = root / "docs" / "skills"
    ensure_dir(docs_skills_dir)
    for skill in skills:
        zh_target = docs_skills_dir / f"{skill.name}.md"
        en_target = docs_skills_dir / f"{skill.name}.en.md"
        if not zh_target.exists():
            zh_content = (
                f"# {skill.name}\n\n"
                "该技能文档尚未补充，请参考对应的 SKILL.md。\n"
            )
            zh_target.write_text(zh_content, encoding="utf-8")
            created.append(zh_target)
        if not en_target.exists():
            en_content = (
                f"# {skill.name}\n\n"
                "Documentation pending. Refer to the corresponding SKILL.md.\n"
            )
            en_target.write_text(en_content, encoding="utf-8")
            created.append(en_target)
    return created


def update_repo_docs(root: Path, skills: List[Path]) -> List[Path]:
    zh_block = build_skill_list(skills, "zh")
    en_block = build_skill_list(skills, "en")
    update_doc(root / "README.md", zh_block)
    update_doc(root / "docs" / "README.md", zh_block)
    update_doc(root / "README.en.md", en_block)
    update_doc(root / "docs" / "README.en.md", en_block)
    return ensure_skill_docs(root, skills)


def main() -> int:
    args = parse_args()

    if args.docs_only and args.install_only:
        print("--docs-only and --install-only cannot be used together.")
        return 2

    try:
        root = resolve_repo_root(args.source_root)
    except Exception as exc:
        print(f"Failed to prepare skill source: {exc}")
        return 1

    skills = discover_skills(root)
    if not skills:
        print(f"No skills found in {root}.")
        return 1

    if not args.docs_only:
        ensure_dir(args.dest)
        for skill in skills:
            status, dest = install_skill(skill, args.dest, args.mode)
            print(f"{status}: {skill.name} -> {dest}")

    if not args.install_only:
        created = update_repo_docs(root, skills)
        for doc in created:
            print(f"created doc stub: {doc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
