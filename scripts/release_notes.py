#!/usr/bin/env python3
"""Extract the GitHub release title and notes for a tag from CHANGELOG.md.

Usage:
    python3 scripts/release_notes.py v2.12.0
    python3 scripts/release_notes.py v2.12.0 --write /tmp/notes.md

Looks first at CHANGELOG.md (a '## … vX.Y.Z …' section), then at
.github/release-notes/vX.Y.Z.md if the section is missing.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHANGELOG = ROOT / "CHANGELOG.md"
NOTES_DIR = ROOT / ".github" / "release-notes"


def extract(tag: str, changelog: Path = CHANGELOG, notes_dir: Path = NOTES_DIR) -> tuple[str, str]:
    """Return (title, body) for the given tag (vX.Y.Z). Raises ValueError if missing."""
    if not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
        raise ValueError(f"Unexpected tag: {tag}")
    if changelog.is_file():
        text = changelog.read_text(encoding="utf-8")
        pattern = re.compile(
            rf"^##[^\n]*{re.escape(tag)}[^\n]*\n(.*?)(?=\n## |\Z)",
            re.M | re.S,
        )
        match = pattern.search(text)
        if match:
            heading = text[match.start():].splitlines()[0]
            title = re.sub(r"^##\s+", "", heading).strip()
            if not title.lower().startswith("maison 3d"):
                title = f"Maison 3D {title}"
            body = match.group(1).strip()
            if body:
                return title, body
    notes = notes_dir / f"{tag}.md"
    if notes.is_file():
        body = notes.read_text(encoding="utf-8").strip()
        first = body.splitlines()[0] if body else ""
        title = re.sub(r"^#\s+", "", first).strip() or f"Maison 3D {tag}"
        if first.startswith("#"):
            body = "\n".join(body.splitlines()[1:]).strip()
        return title, body
    raise ValueError(
        f"No release notes for {tag}: add a '## {tag} — …' section to CHANGELOG.md "
        f"or a file at .github/release-notes/{tag}.md"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", help="Git tag, e.g. v2.12.0")
    parser.add_argument("--write", type=Path, help="Write the notes body to this file")
    args = parser.parse_args(argv)
    try:
        title, body = extract(args.tag)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(title)
    if args.write:
        args.write.write_text(body + "\n", encoding="utf-8")
    else:
        print()
        print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
