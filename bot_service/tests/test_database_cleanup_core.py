from core.datetime_utils import utcnow_naive
from models import User, UserSession, UserSettings
from models.tts import TTSUserSettings
from services.database_maintenance.database_cleanup_core import DatabaseCleanupCore


def test_preview_orphan_user_records_counts_only_missing_user_rows(db):
    user = User(twitch_username="cleanup_owner", role="user", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add_all(
        [
            UserSettings(user_id=user.id),
            UserSettings(user_id=999),
            UserSettings(session_id="legacy-session-settings"),
            TTSUserSettings(user_id=user.id),
            TTSUserSettings(user_id=999),
            TTSUserSettings(session_id="legacy-session-tts"),
        ]
    )
    db.commit()

    cleanup_core = DatabaseCleanupCore(db)
    preview = cleanup_core.preview_orphan_user_records()

    assert preview["tables"]["user_settings"] == 1
    assert preview["tables"]["tts_user_settings"] == 1
    assert preview["total_rows"] == 2


def test_cleanup_orphan_user_records_removes_only_orphans(db):
    user = User(twitch_username="cleanup_owner", role="user", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add_all(
        [
            UserSettings(user_id=user.id),
            UserSettings(user_id=999),
            UserSettings(session_id="legacy-session-settings"),
            TTSUserSettings(user_id=user.id),
            TTSUserSettings(user_id=999),
            TTSUserSettings(session_id="legacy-session-tts"),
        ]
    )
    db.commit()

    cleanup_core = DatabaseCleanupCore(db)
    result = cleanup_core.cleanup_orphan_user_records()

    assert result["tables"]["user_settings"] == 1
    assert result["tables"]["tts_user_settings"] == 1
    assert result["total_rows"] == 2
    assert db.query(UserSettings).filter(UserSettings.user_id == user.id).count() == 1
    assert db.query(UserSettings).filter(UserSettings.session_id == "legacy-session-settings").count() == 1
    assert db.query(UserSettings).filter(UserSettings.user_id == 999).count() == 0
    assert db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user.id).count() == 1
    assert db.query(TTSUserSettings).filter(TTSUserSettings.session_id == "legacy-session-tts").count() == 1
    assert db.query(TTSUserSettings).filter(TTSUserSettings.user_id == 999).count() == 0


def test_cleanup_inactive_sessions_respects_activity_and_retention(db):
    from datetime import timedelta

    user = User(twitch_username="session_owner", role="user", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    now = utcnow_naive()

    db.add_all(
        [
            UserSession(
                user_id=user.id,
                session_id="active-old-session",
                device_info={"platform": "twitch"},
                is_active=True,
                created_at=now - timedelta(days=14),
                last_activity=now - timedelta(days=14),
            ),
            UserSession(
                user_id=user.id,
                session_id="inactive-recent-session",
                device_info={"platform": "twitch"},
                is_active=False,
                created_at=now - timedelta(days=2),
                last_activity=now - timedelta(days=2),
            ),
            UserSession(
                user_id=user.id,
                session_id="inactive-old-session",
                device_info={"platform": "twitch"},
                is_active=False,
                created_at=now - timedelta(days=14),
                last_activity=now - timedelta(days=14),
            ),
        ]
    )
    db.commit()

    cleanup_core = DatabaseCleanupCore(db)
    preview = cleanup_core.preview_inactive_session_cleanup(days_old=7)
    result = cleanup_core.cleanup_inactive_sessions(days_old=7)

    assert preview["old_inactive_sessions"] == 1
    assert result["deleted_sessions"] == 1
    assert db.query(UserSession).filter(UserSession.session_id == "inactive-old-session").count() == 0
    assert db.query(UserSession).filter(UserSession.session_id == "inactive-recent-session").count() == 1
    assert db.query(UserSession).filter(UserSession.session_id == "active-old-session").count() == 1
