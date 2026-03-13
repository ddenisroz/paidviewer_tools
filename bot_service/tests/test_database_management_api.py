from datetime import timedelta

from core.datetime_utils import utcnow_naive
from models import User, UserSession, UserSettings


def test_database_hygiene_preview_endpoint(admin_client, db):
    admin = db.query(User).filter(User.role == "admin").first()
    assert admin is not None

    db.add_all(
        [
            UserSettings(user_id=999),
            UserSession(
                user_id=admin.id,
                session_id="inactive-preview-session",
                device_info={"platform": "twitch"},
                is_active=False,
                created_at=utcnow_naive() - timedelta(days=10),
                last_activity=utcnow_naive() - timedelta(days=10),
            ),
        ]
    )
    db.commit()

    response = admin_client.get("/api/database/hygiene/preview?inactive_session_days=7")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["orphan_user_records"]["tables"]["user_settings"] == 1
    assert payload["data"]["inactive_sessions"]["old_inactive_sessions"] == 1


def test_database_hygiene_cleanup_endpoint(admin_client, db):
    admin = db.query(User).filter(User.role == "admin").first()
    assert admin is not None

    db.add_all(
        [
            UserSettings(user_id=999),
            UserSession(
                user_id=admin.id,
                session_id="inactive-cleanup-session",
                device_info={"platform": "twitch"},
                is_active=False,
                created_at=utcnow_naive() - timedelta(days=10),
                last_activity=utcnow_naive() - timedelta(days=10),
            ),
        ]
    )
    db.commit()

    response = admin_client.post(
        "/api/database/hygiene/cleanup",
        json={
            "clean_orphan_users": True,
            "clean_inactive_sessions": True,
            "inactive_session_days": 7,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["orphan_user_records"]["tables"]["user_settings"] == 1
    assert payload["data"]["inactive_sessions"]["deleted_sessions"] == 1
    assert db.query(UserSettings).filter(UserSettings.user_id == 999).count() == 0
    assert db.query(UserSession).filter(UserSession.session_id == "inactive-cleanup-session").count() == 0
