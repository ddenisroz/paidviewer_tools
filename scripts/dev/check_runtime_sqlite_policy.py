"""Validate SQLite policy: runtime code must not use SQLite DSNs.

Allowed zones:
- bot_service/tests/**
- bot_service/alembic/**
- bot_service/scripts/archive/**
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOT_SERVICE = ROOT / "bot_service"

ALLOWED_PREFIXES = (
    (BOT_SERVICE / "tests").resolve(),
    (BOT_SERVICE / "alembic").resolve(),
    (BOT_SERVICE / "scripts" / "archive").resolve(),
)

SCAN_SUFFIXES = {".py", ".env", ".example", ".md", ".txt", ".yaml", ".yml"}
PATTERNS = ("sqlite:///", "sqlite://", " sqlite ", "sqlite)", "sqlite,")


def is_allowed(path: Path) -> bool:
    rp = path.resolve()
    return any(str(rp).startswith(str(prefix)) for prefix in ALLOWED_PREFIXES)


def should_scan(path: Path) -> bool:
    if path.suffix.lower() in SCAN_SUFFIXES:
        return True
    name = path.name.lower()
    return name.endswith(".env") or name.endswith(".env.example")


def main() -> int:
    violations: list[tuple[Path, int, str]] = []

    for path in BOT_SERVICE.rglob("*"):
        if not path.is_file() or not should_scan(path):
            continue
        if is_allowed(path):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        for lineno, line in enumerate(text.splitlines(), start=1):
            line_lower = line.lower()
            if any(pattern in line_lower for pattern in PATTERNS):
                violations.append((path.relative_to(ROOT), lineno, line.strip()))

    if not violations:
        print("[OK] SQLite runtime policy check passed")
        return 0

    print("[FAIL] SQLite runtime policy violations found:")
    for rel_path, lineno, snippet in violations:
        print(f"  - {rel_path}:{lineno}: {snippet}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
