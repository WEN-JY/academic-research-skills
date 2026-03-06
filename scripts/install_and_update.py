#!/usr/bin/env python3
"""Install skills and update documentation.

- Discovers skill folders by locating SKILL.md files at repo root.
- Installs skills to $CODEX_HOME/skills or ~/.codex/skills by default.
- Updates README.md and docs/README.md skill lists via markers.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
README_PATH = ROOT / "README.md"
README_EN_PATH = ROOT / "README.en.md"
DOCS_README_PATH = ROOT / "docs" / "README.md"
DOCS_README_EN_PATH = ROOT / "docs" / "README.en.md"
DOCS_SKILLS_DIR = ROOT / "docs" / "skills"

SKILLS_START = "<!-- SKILLS:START -->"
SKILLS_END = "<!-- SKILLS:END -->"


def discover_skills() -> List[Path]:
    skills = []
    for item in ROOT.iterdir():
        if not item.is_dir():
            continue
        if item.name in {".git", ".claude", "docs", "scripts"}:
            continue
        if (item / "SKILL.md").is_file():
            skills.append(item)
    return sorted(skills, key=lambda p: p.name)


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


def default_install_dir() -> Path:
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home) / "skills"
    return Path.home() / ".codex" / "skills"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def backup_existing(path: Path) -> Path:
    timestamp = time.strftime("%Y%m%d%H%M%S")
    backup = path.with_name(f"{path.name}.bak-{timestamp}")
    path.rename(backup)
    return backup


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


def ensure_skill_docs(skills: List[Path]) -> List[Path]:
    created = []
    ensure_dir(DOCS_SKILLS_DIR)
    for skill in skills:
        zh_target = DOCS_SKILLS_DIR / f"{skill.name}.md"
        en_target = DOCS_SKILLS_DIR / f"{skill.name}.en.md"
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


def main() -> int:
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
    args = parser.parse_args()

    if args.docs_only and args.install_only:
        print("--docs-only and --install-only cannot be used together.")
        return 2

    skills = discover_skills()
    if not skills:
        print("No skills found.")
        return 1

    if not args.docs_only:
        ensure_dir(args.dest)
        for skill in skills:
            status, dest = install_skill(skill, args.dest, args.mode)
            print(f"{status}: {skill.name} -> {dest}")

    if not args.install_only:
        zh_block = build_skill_list(skills, "zh")
        en_block = build_skill_list(skills, "en")
        update_doc(README_PATH, zh_block)
        update_doc(DOCS_README_PATH, zh_block)
        update_doc(README_EN_PATH, en_block)
        update_doc(DOCS_README_EN_PATH, en_block)
        created = ensure_skill_docs(skills)
        for doc in created:
            print(f"created doc stub: {doc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
