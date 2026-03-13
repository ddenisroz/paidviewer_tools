#!/usr/bin/env python3
"""Предпросмотр и безопасная очистка мусора в базе данных."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BOT_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(BOT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_SERVICE_ROOT))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

if load_dotenv:
    load_dotenv(BOT_SERVICE_ROOT / ".env", override=False)

from models import SessionLocal  # noqa: E402
from services.database_cleanup_service import DatabaseCleanupService  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Проверка и безопасная очистка orphan-записей, legacy session_id-хвостов "
            "и старых неактивных сессий."
        ),
    )
    parser.add_argument(
        "--orphan-users",
        action="store_true",
        help="Проверить и при необходимости очистить записи с несуществующим user_id.",
    )
    parser.add_argument(
        "--legacy-session-records",
        action="store_true",
        help="Очистить legacy session_id-записи в активных user-only таблицах.",
    )
    parser.add_argument(
        "--inactive-sessions",
        action="store_true",
        help="Проверить и при необходимости очистить старые неактивные сессии.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Запустить все проверки и очистки сразу.",
    )
    parser.add_argument(
        "--inactive-session-days",
        type=int,
        default=7,
        help="Сколько дней хранить неактивные сессии перед удалением. По умолчанию: 7.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Фактически выполнить очистку после preview.",
    )
    return parser.parse_args()


def _selected_actions(args: argparse.Namespace) -> tuple[bool, bool, bool]:
    clean_orphans = args.all or args.orphan_users
    clean_legacy_sessions = args.all or args.legacy_session_records
    clean_sessions = args.all or args.inactive_sessions
    if not clean_orphans and not clean_legacy_sessions and not clean_sessions:
        return True, True, True
    return clean_orphans, clean_legacy_sessions, clean_sessions


def _print_table_preview(title: str, preview: dict) -> None:
    print(f"{title}:")
    print(f"  всего строк к очистке: {preview.get('total_rows', 0)}")
    for table_name, count in preview.get("tables", {}).items():
        if count:
            print(f"    {table_name}: {count}")


def _print_session_preview(preview: dict) -> None:
    print("Неактивные сессии:")
    print(f"  retention: {preview.get('retention_days', 7)} дн.")
    print(f"  всего сессий: {preview.get('total_sessions', 0)}")
    print(f"  активных: {preview.get('active_sessions', 0)}")
    print(f"  неактивных: {preview.get('inactive_sessions', 0)}")
    print(f"  к удалению: {preview.get('old_inactive_sessions', 0)}")


def main() -> int:
    if not os.getenv("DATABASE_URL"):
        print("Не задана переменная DATABASE_URL.")
        return 1

    args = parse_args()
    clean_orphans, clean_legacy_sessions, clean_sessions = _selected_actions(args)

    db = SessionLocal()
    try:
        cleanup_service = DatabaseCleanupService(db)

        print("=== Preview database hygiene ===")
        if clean_orphans:
            orphan_preview = cleanup_service.preview_orphan_user_records()
            _print_table_preview("Orphan user-записи", orphan_preview)
            print()

        if clean_legacy_sessions:
            legacy_preview = cleanup_service.preview_legacy_session_records()
            _print_table_preview("Legacy session_id-записи", legacy_preview)
            print()

        if clean_sessions:
            session_preview = cleanup_service.preview_inactive_session_cleanup(args.inactive_session_days)
            _print_session_preview(session_preview)
            print()

        if not args.yes:
            print("Это был только preview. Запусти снова с --yes для фактической очистки.")
            return 0

        print("=== Выполняю очистку ===")
        if clean_orphans:
            orphan_result = cleanup_service.cleanup_orphan_user_records()
            print(f"Очищено orphan-строк: {orphan_result.get('total_rows', 0)}")
            for table_name, count in orphan_result.get("tables", {}).items():
                if count:
                    print(f"  {table_name}: {count}")

        if clean_legacy_sessions:
            legacy_result = cleanup_service.cleanup_legacy_session_records()
            print(f"Очищено legacy session_id-строк: {legacy_result.get('total_rows', 0)}")
            for table_name, count in legacy_result.get("tables", {}).items():
                if count:
                    print(f"  {table_name}: {count}")

        if clean_sessions:
            session_result = cleanup_service.cleanup_inactive_sessions(args.inactive_session_days)
            print(f"Очищено старых неактивных сессий: {session_result.get('deleted_sessions', 0)}")

        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
