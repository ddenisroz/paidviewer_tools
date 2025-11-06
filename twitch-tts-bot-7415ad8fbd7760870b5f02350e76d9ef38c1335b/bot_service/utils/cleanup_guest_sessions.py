"""
Утилита для очистки старых и неактивных гостевых сессий

Запуск:
    python -m utils.cleanup_guest_sessions [--days DAYS] [--dry-run]

Параметры:
    --days DAYS     Удалять сессии старше указанного количества дней (по умолчанию 7)
    --dry-run       Показать, что будет удалено, без фактического удаления
"""
import sys
import logging
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Добавляем путь к bot_service в sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import SessionLocal, GuestSession, UserSettings, TTSUserSettings, AudioSettings
from core.database import LocalTTSEndpoint, FilteredWord, TTSBlockedUser, YouTubeQueue

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def cleanup_guest_sessions(days: int = 7, dry_run: bool = False):
    """
    Удаляет неактивные гостевые сессии старше указанного количества дней
    
    Args:
        days: Количество дней неактивности для удаления сессии
        dry_run: Если True, только показывает что будет удалено
    """
    db = SessionLocal()
    try:
        # Вычисляем дату отсечки
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Находим старые гостевые сессии
        old_guest_sessions = db.query(GuestSession).filter(
            GuestSession.last_activity < cutoff_date
        ).all()
        
        # Находим неактивные гостевые сессии (is_active = False)
        inactive_guest_sessions = db.query(GuestSession).filter(
            GuestSession.is_active == False
        ).all()
        
        # Объединяем (убираем дубликаты)
        sessions_to_delete = list(set(old_guest_sessions + inactive_guest_sessions))
        
        if not sessions_to_delete:
            logger.info("✅ No guest sessions to clean up")
            return
        
        logger.info(f"🔍 Found {len(sessions_to_delete)} guest sessions to clean up:")
        logger.info(f"   - {len(old_guest_sessions)} old sessions (last activity > {days} days ago)")
        logger.info(f"   - {len(inactive_guest_sessions)} inactive sessions (is_active = False)")
        
        total_settings_deleted = 0
        
        for session in sessions_to_delete:
            session_id = session.session_id
            channel_name = session.channel_name
            platform = session.platform
            last_activity = session.last_activity
            days_inactive = (datetime.utcnow() - last_activity).days if last_activity else 999
            
            logger.info(f"  🗑️  Session: {session_id[:16]}... | Channel: {channel_name} ({platform}) | Inactive for: {days_inactive} days")
            
            if not dry_run:
                # Удаляем связанные настройки гостя
                try:
                    deleted = 0
                    deleted += db.query(UserSettings).filter(UserSettings.session_id == session_id).delete()
                    deleted += db.query(TTSUserSettings).filter(TTSUserSettings.session_id == session_id).delete()
                    deleted += db.query(AudioSettings).filter(AudioSettings.session_id == session_id).delete()
                    deleted += db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.session_id == session_id).delete()
                    deleted += db.query(FilteredWord).filter(FilteredWord.session_id == session_id).delete()
                    deleted += db.query(TTSBlockedUser).filter(TTSBlockedUser.session_id == session_id).delete()
                    deleted += db.query(YouTubeQueue).filter(YouTubeQueue.session_id == session_id).delete()
                    
                    total_settings_deleted += deleted
                    
                    if deleted > 0:
                        logger.info(f"     └─ Deleted {deleted} related settings")
                    
                    # Удаляем саму гостевую сессию
                    db.delete(session)
                    
                except Exception as e:
                    logger.error(f"     └─ Error deleting settings for session {session_id}: {e}")
        
        if dry_run:
            logger.info(f"\n🔍 DRY RUN: Would delete {len(sessions_to_delete)} guest sessions")
            logger.info(f"   (Run without --dry-run to actually delete)")
        else:
            db.commit()
            logger.info(f"\n✅ Cleanup completed:")
            logger.info(f"   - Deleted {len(sessions_to_delete)} guest sessions")
            logger.info(f"   - Deleted {total_settings_deleted} related settings records")
    
    except Exception as e:
        logger.error(f"❌ Error during cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def cleanup_orphaned_guest_settings():
    """
    Удаляет настройки гостей, которые не привязаны к активным сессиям
    """
    db = SessionLocal()
    try:
        # Получаем все session_id активных гостевых сессий
        active_session_ids = {s.session_id for s in db.query(GuestSession.session_id).filter(
            GuestSession.is_active == True
        ).all()}
        
        # Находим orphaned настройки (где session_id не в списке активных)
        orphaned_count = 0
        
        for model in [UserSettings, TTSUserSettings, AudioSettings, LocalTTSEndpoint, 
                      FilteredWord, TTSBlockedUser, YouTubeQueue]:
            # Получаем все записи с session_id
            records = db.query(model).filter(model.session_id.isnot(None)).all()
            
            for record in records:
                if record.session_id not in active_session_ids:
                    logger.info(f"🗑️  Orphaned {model.__name__}: session_id={record.session_id[:16]}...")
                    db.delete(record)
                    orphaned_count += 1
        
        if orphaned_count > 0:
            db.commit()
            logger.info(f"✅ Cleaned up {orphaned_count} orphaned guest settings")
        else:
            logger.info(f"✅ No orphaned guest settings found")
    
    except Exception as e:
        logger.error(f"❌ Error cleaning orphaned settings: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Cleanup old and inactive guest sessions"
    )
    parser.add_argument(
        '--days',
        type=int,
        default=7,
        help='Delete sessions older than this many days (default: 7)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    parser.add_argument(
        '--orphaned-only',
        action='store_true',
        help='Only clean up orphaned guest settings (not the sessions themselves)'
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 70)
    logger.info("🧹 Guest Sessions Cleanup Utility")
    logger.info("=" * 70)
    
    if args.orphaned_only:
        logger.info("\n📋 Mode: Cleaning orphaned guest settings only\n")
        cleanup_orphaned_guest_settings()
    else:
        logger.info(f"\n📋 Mode: Cleaning sessions older than {args.days} days")
        logger.info(f"📋 Dry run: {'Yes' if args.dry_run else 'No'}\n")
        cleanup_guest_sessions(days=args.days, dry_run=args.dry_run)
        
        # После основной очистки, также проверяем orphaned настройки
        if not args.dry_run:
            logger.info("\n🔍 Checking for orphaned guest settings...")
            cleanup_orphaned_guest_settings()
    
    logger.info("\n" + "=" * 70)
    logger.info("✅ Cleanup completed successfully")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()

