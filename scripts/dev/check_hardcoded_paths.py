#!/usr/bin/env python3
"""
Detect hardcoded local absolute filesystem paths in runtime-oriented source files.

The check ignores URLs and focuses on likely local machine paths:
- Windows style: C:\... or C:/...
- Unix style: /home/... /Users/... /var/... /tmp/... /opt/... /etc/... /srv/... /mnt/... /app/...
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


TEXT_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".ps1",
    ".sh",
}

SCAN_ROOTS = ("bot_service", "frontend", "F5_tts", "scripts")
SKIP_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".nyc_output",
    ".vitest",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
}
DEFAULT_SKIP_CONTAINS = [
    "bot_service/tests/",
    "bot_service/scripts/archive/",
    "scripts/dev/",
    "frontend/package-lock.json",
]

WINDOWS_PATH_RE = re.compile(r"\b[A-Za-z]:[\\/](?!/)[^\s'\"`]+")
UNIX_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_@:])\/(?:home|Users|var|tmp|opt|etc|srv|mnt)"
    r"(?:\/[^\s'\"`]+)?(?=$|[\s'\"`])"
)


@dataclass(frozen=True)
class PathIssue:
    path: Path
    line_no: int
    value: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument(
        "--include-tests",
        action="store_true",
        help="Include tests/archive/dev scripts in scan",
    )
    parser.add_argument(
        "--skip-contains",
        action="append",
        default=[],
        help="Skip files containing this path fragment",
    )
    parser.add_argument("--max-lines", type=int, default=200, help="Max issues to print")
    return parser.parse_args()


def iter_source_files(root: Path, skip_contains: list[str]) -> Iterable[Path]:
    for sub in SCAN_ROOTS:
        sub_path = root / sub
        if not sub_path.exists():
            continue
        for path in sub_path.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            rel = path.relative_to(root).as_posix()
            if any(fragment in rel for fragment in skip_contains):
                continue
            yield path


def _is_url_like(value: str) -> bool:
    lower = value.lower()
    return lower.startswith(
        (
            "http:/",
            "https:/",
            "ws:/",
            "wss:/",
            "redis:/",
            "postgresql:/",
            "sqlite:/",
            "file:/",
        )
    )


def find_issues(path: Path) -> list[PathIssue]:
    issues: list[PathIssue] = []
    text = path.read_text(encoding="utf-8", errors="strict")
    for line_no, line in enumerate(text.splitlines(), 1):
        for match in WINDOWS_PATH_RE.finditer(line):
            value = match.group(0)
            if not _is_url_like(value):
                issues.append(PathIssue(path=path, line_no=line_no, value=value))
        for match in UNIX_PATH_RE.finditer(line):
            value = match.group(0)
            issues.append(PathIssue(path=path, line_no=line_no, value=value))
    return issues


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    skip_contains = list(DEFAULT_SKIP_CONTAINS)
    if args.include_tests:
        skip_contains = []
    skip_contains.extend(args.skip_contains)

    issues: list[PathIssue] = []
    for path in iter_source_files(root, skip_contains):
        try:
            issues.extend(find_issues(path))
        except UnicodeError:
            # Encoding integrity should be checked by check_mojibake.py
            continue

    print("=== Hardcoded Local Path Issues ===")
    if not issues:
        print("None")
    else:
        for issue in issues[: args.max_lines]:
            rel = issue.path.relative_to(root).as_posix()
            print(f"{rel}:{issue.line_no}  {issue.value}")

    print(f"\nTotals: issues={len(issues)} (printed up to {args.max_lines})")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
