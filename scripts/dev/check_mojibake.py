#!/usr/bin/env python3
"""
Detect likely broken text encodings (mojibake) in repository files.

This check is conservative by design:
- it treats non-UTF8 files as errors,
- flags replacement characters (U+FFFD),
- flags lines matching common mojibake chains.

Usage:
  python scripts/dev/check_mojibake.py
  python scripts/dev/check_mojibake.py --root bot_service
  python scripts/dev/check_mojibake.py --max-lines 100
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


TEXT_SUFFIXES = {
    ".py",
    ".md",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".ps1",
    ".sh",
    ".ts",
    ".tsx",
    ".d.ts",
    ".css",
    ".scss",
    ".html",
}

SKIP_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
}

# Legacy archive scripts may intentionally preserve historical broken text
# and should not block current release checks.
DEFAULT_SKIP_CONTAINS = [
    "bot_service/scripts/archive/legacy/",
    "frontend/lint_output.txt",
]

# Common chains produced by UTF-8 <-> cp1251/cp1252 mis-decoding.
MOJIBAKE_PATTERNS = [
    re.compile(r"(?:Ð[A-Za-z0-9\u00A0-\u024F\u0400-\u04FF]|Ñ[A-Za-z0-9\u00A0-\u024F\u0400-\u04FF]){3,}"),
    re.compile(r"(?:Р[A-Za-z0-9\u00A0-\u024F\u0400-\u04FF]|С[A-Za-z0-9\u00A0-\u024F\u0400-\u04FF]){3,}"),
    re.compile(r"(?:Ã[A-Za-z0-9\u00A0-\u024F\u0400-\u04FF]|Â[A-Za-z0-9\u00A0-\u024F\u0400-\u04FF]){3,}"),
]


@dataclass(frozen=True)
class EncodingIssue:
    path: Path
    kind: str
    detail: str


@dataclass(frozen=True)
class LineIssue:
    path: Path
    line_no: int
    pattern: str
    snippet: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Root folder to scan")
    parser.add_argument("--max-lines", type=int, default=200, help="Max suspicious lines to print")
    parser.add_argument(
        "--skip-contains",
        action="append",
        default=[],
        help="Skip files that contain this path fragment (can be passed multiple times)",
    )
    parser.add_argument(
        "--include-legacy",
        action="store_true",
        help="Include legacy archive paths that are skipped by default",
    )
    return parser.parse_args()


def iter_text_files(root: Path, skip_contains: list[str]) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        rel = path.as_posix()
        if any(fragment in rel for fragment in skip_contains):
            continue
        yield path


def _safe_snippet(line: str, limit: int = 180) -> str:
    snippet = line.strip()
    if len(snippet) > limit:
        snippet = snippet[:limit] + "..."
    return snippet


def scan_file(path: Path) -> tuple[list[EncodingIssue], list[LineIssue]]:
    encoding_issues: list[EncodingIssue] = []
    line_issues: list[LineIssue] = []

    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        encoding_issues.append(
            EncodingIssue(
                path=path,
                kind="non_utf8",
                detail=f"invalid UTF-8 at byte {exc.start}",
            )
        )
        return encoding_issues, line_issues

    if "\ufffd" in text:
        encoding_issues.append(
            EncodingIssue(
                path=path,
                kind="replacement_char",
                detail="contains U+FFFD replacement character",
            )
        )

    for line_no, line in enumerate(text.splitlines(), 1):
        for pattern in MOJIBAKE_PATTERNS:
            if pattern.search(line):
                line_issues.append(
                    LineIssue(
                        path=path,
                        line_no=line_no,
                        pattern=pattern.pattern,
                        snippet=_safe_snippet(line),
                    )
                )
                break

    return encoding_issues, line_issues


def main() -> int:
    args = parse_args()
    root = Path(args.root)
    skip_contains = list(DEFAULT_SKIP_CONTAINS)
    if args.include_legacy:
        skip_contains = []
    skip_contains.extend(args.skip_contains)
    encoding_issues: list[EncodingIssue] = []
    line_issues: list[LineIssue] = []

    for path in iter_text_files(root, skip_contains):
        file_encoding_issues, file_line_issues = scan_file(path)
        encoding_issues.extend(file_encoding_issues)
        line_issues.extend(file_line_issues)

    print("=== Encoding Issues ===")
    if not encoding_issues:
        print("None")
    else:
        for issue in encoding_issues:
            print(f"{issue.path.as_posix()}: {issue.kind} ({issue.detail})")

    print("\n=== Suspicious Mojibake Lines ===")
    if not line_issues:
        print("None")
    else:
        for issue in line_issues[: args.max_lines]:
            safe_snippet = issue.snippet.encode("unicode_escape").decode("ascii")
            print(f"{issue.path.as_posix()}:{issue.line_no}  {safe_snippet}")

    print(
        f"\nTotals: encoding_issues={len(encoding_issues)} "
        f"line_issues={len(line_issues)} (printed up to {args.max_lines})"
    )

    return 1 if encoding_issues or line_issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
