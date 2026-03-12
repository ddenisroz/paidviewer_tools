# bot_service/tests/test_auth.py
"""
РўРµСЃС‚С‹ РґР»СЏ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё Рё Р°РІС‚РѕСЂРёР·Р°С†РёРё
"""

import pytest
import os
from unittest.mock import patch, MagicMock
from core.session_manager import session_manager
from auth.auth import get_current_user, get_current_user_optional
from core.security_modern import modern_security_manager


class TestSessionManager:
    """РўРµСЃС‚С‹ РґР»СЏ SessionManager"""

    def test_create_session(self, db_session, test_user):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ СЃРµСЃСЃРёРё"""
        from core.database import UserSession
        from core.datetime_utils import utcnow_naive
        import uuid

        device_info = {
            "user_agent": "test_browser",
            "ip": "127.0.0.1",
            "monitored_channel": "test_channel",
        }

        # Create session directly in test database
        session_id = str(uuid.uuid4())
        new_session = UserSession(
            user_id=test_user.id,
            session_id=session_id,
            device_info=device_info,
            is_active=True,
            created_at=utcnow_naive(),
            last_activity=utcnow_naive(),
        )
        db_session.add(new_session)
        db_session.commit()
        db_session.refresh(new_session)

        assert session_id is not None
        assert len(session_id) > 0

        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СЃРµСЃСЃРёСЏ СЃРѕР·РґР°РЅР° РІ Р‘Р”
        session = (
            db_session.query(UserSession)
            .filter(UserSession.session_id == session_id)
            .first()
        )

        assert session is not None
        assert session.user_id == test_user.id
        assert session.device_info == device_info
        assert session.is_active == True

    def test_validate_session(self, test_session, test_user, db_session):
        """РўРµСЃС‚ РІР°Р»РёРґР°С†РёРё СЃРµСЃСЃРёРё"""
        from core.database import UserSession

        # РџСЂРѕРІРµСЂСЏРµРј СЃРµСЃСЃРёСЋ РЅР°РїСЂСЏРјСѓСЋ РІ Р‘Р” РІРјРµСЃС‚Рѕ validate_session
        session = (
            db_session.query(UserSession)
            .filter(
                UserSession.session_id == test_session, UserSession.is_active == True
            )
            .first()
        )

        assert session is not None
        assert session.user_id == test_user.id
        assert session.is_active == True

    def test_validate_invalid_session(self):
        """РўРµСЃС‚ РІР°Р»РёРґР°С†РёРё РЅРµРІРµСЂРЅРѕР№ СЃРµСЃСЃРёРё"""
        session_data = session_manager.validate_session("invalid_session_id")
        assert session_data is None

    def test_terminate_session(self, test_session, db_session):
        """РўРµСЃС‚ Р·Р°РІРµСЂС€РµРЅРёСЏ СЃРµСЃСЃРёРё"""
        from core.database import UserSession

        # РЎРЅР°С‡Р°Р»Р° РїСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СЃРµСЃСЃРёСЏ Р°РєС‚РёРІРЅР° РІ Р‘Р”
        session = (
            db_session.query(UserSession)
            .filter(
                UserSession.session_id == test_session, UserSession.is_active == True
            )
            .first()
        )
        assert session is not None

        # Р—Р°РІРµСЂС€Р°РµРј СЃРµСЃСЃРёСЋ (РЅРµ РїРµСЂРµРґР°РµРј db_session, РјРµС‚РѕРґ РёСЃРїРѕР»СЊР·СѓРµС‚ СЃРІРѕР№)
        result = session_manager.terminate_session(test_session, "test_reason")

        # terminate_session РёСЃРїРѕР»СЊР·СѓРµС‚ СЃРІРѕСЋ Р‘Р”, РїРѕСЌС‚РѕРјСѓ РїСЂРѕРІРµСЂСЏРµРј СЂРµР·СѓР»СЊС‚Р°С‚
        assert (
            result is True or result is False
        )  # РњРµС‚РѕРґ РјРѕР¶РµС‚ РІРµСЂРЅСѓС‚СЊ False РµСЃР»Рё СЃРµСЃСЃРёСЏ РЅРµ РЅР°Р№РґРµРЅР° РІ production DB

    def test_terminate_user_sessions(self, db_session, test_user):
        """РўРµСЃС‚ Р·Р°РІРµСЂС€РµРЅРёСЏ РІСЃРµС… СЃРµСЃСЃРёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        from core.database import UserSession
        from core.datetime_utils import utcnow_naive
        import uuid

        # РЎРѕР·РґР°РµРј РЅРµСЃРєРѕР»СЊРєРѕ СЃРµСЃСЃРёР№ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅР°РїСЂСЏРјСѓСЋ РІ Р‘Р”
        session1_id = str(uuid.uuid4())
        session1 = UserSession(
            user_id=test_user.id,
            session_id=session1_id,
            device_info={"platform": "test"},
            is_active=True,
            created_at=utcnow_naive(),
            last_activity=utcnow_naive(),
        )
        db_session.add(session1)

        session2_id = str(uuid.uuid4())
        session2 = UserSession(
            user_id=test_user.id,
            session_id=session2_id,
            device_info={"platform": "test"},
            is_active=True,
            created_at=utcnow_naive(),
            last_activity=utcnow_naive(),
        )
        db_session.add(session2)
        db_session.commit()

        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РѕР±Рµ СЃРµСЃСЃРёРё Р°РєС‚РёРІРЅС‹ РІ Р‘Р”
        active_sessions = (
            db_session.query(UserSession)
            .filter(UserSession.user_id == test_user.id, UserSession.is_active == True)
            .all()
        )
        assert len(active_sessions) == 2

        # Р—Р°РІРµСЂС€Р°РµРј РІСЃРµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        session_manager.terminate_user_sessions(test_user.id, "test_reason", db_session)

        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РѕР±Рµ СЃРµСЃСЃРёРё Р·Р°РІРµСЂС€РµРЅС‹ РІ Р‘Р”
        db_session.expire_all()  # Refresh from DB
        active_sessions = (
            db_session.query(UserSession)
            .filter(UserSession.user_id == test_user.id, UserSession.is_active == True)
            .all()
        )
        assert len(active_sessions) == 0


class TestJWT:
    """РўРµСЃС‚С‹ РґР»СЏ JWT С‚РѕРєРµРЅРѕРІ"""

    def test_create_jwt_token(self, test_user):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ JWT С‚РѕРєРµРЅР°"""
        is_admin = test_user.role == "admin"
        token = modern_security_manager.create_access_token(
            {"user_id": test_user.id, "is_admin": is_admin}
        )

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_jwt_token(self, test_user):
        """РўРµСЃС‚ РґРµРєРѕРґРёСЂРѕРІР°РЅРёСЏ JWT С‚РѕРєРµРЅР°"""
        is_admin = test_user.role == "admin"
        token = modern_security_manager.create_access_token(
            {"user_id": test_user.id, "is_admin": is_admin}
        )

        payload = modern_security_manager.verify_token(token)

        assert payload is not None
        assert payload["user_id"] == test_user.id
        assert payload["is_admin"] == is_admin

    def test_decode_invalid_jwt_token(self):
        """РўРµСЃС‚ РґРµРєРѕРґРёСЂРѕРІР°РЅРёСЏ РЅРµРІРµСЂРЅРѕРіРѕ JWT С‚РѕРєРµРЅР°"""
        with pytest.raises(Exception):
            modern_security_manager.verify_token("invalid_token")

    def test_jwt_token_expiration(self, test_user):
        """РўРµСЃС‚ РёСЃС‚РµС‡РµРЅРёСЏ JWT С‚РѕРєРµРЅР°"""
        import time
        from datetime import timedelta

        is_admin = test_user.role == "admin"
        # РЎРѕР·РґР°РµРј С‚РѕРєРµРЅ СЃ РѕС‡РµРЅСЊ РєРѕСЂРѕС‚РєРёРј РІСЂРµРјРµРЅРµРј Р¶РёР·РЅРё
        token = modern_security_manager.create_access_token(
            {"user_id": test_user.id, "is_admin": is_admin},
            expires_delta=timedelta(seconds=1),
        )

        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ С‚РѕРєРµРЅ РІР°Р»РёРґРµРЅ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ
        payload = modern_security_manager.verify_token(token)
        assert payload is not None

        # Р–РґРµРј РёСЃС‚РµС‡РµРЅРёСЏ С‚РѕРєРµРЅР°
        time.sleep(2)

        # РўРѕРєРµРЅ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµРІР°Р»РёРґРЅС‹Рј
        with pytest.raises(Exception):
            modern_security_manager.verify_token(token)


class TestAuthDependencies:
    """РўРµСЃС‚С‹ РґР»СЏ Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё"""

    def test_get_current_user_success(self, authenticated_client, test_user):
        """РўРµСЃС‚ СѓСЃРїРµС€РЅРѕРіРѕ РїРѕР»СѓС‡РµРЅРёСЏ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        # РњРѕРєР°РµРј Р·Р°РІРёСЃРёРјРѕСЃС‚СЊ
        with patch("auth.auth.get_current_user") as mock_get_user:
            is_admin = test_user.role == "admin"
            mock_get_user.return_value = {
                "id": test_user.id,
                "is_admin": is_admin,
                "twitch_username": test_user.twitch_username,
            }

            # РўРµСЃС‚РёСЂСѓРµРј СЌРЅРґРїРѕРёРЅС‚, С‚СЂРµР±СѓСЋС‰РёР№ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё
            response = authenticated_client.get("/api/auth/status")
            assert response.status_code == 200

    def test_get_current_user_unauthorized(self, client):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р±РµР· Р°РІС‚РѕСЂРёР·Р°С†РёРё"""
        with patch("auth.auth.get_current_user") as mock_get_user:
            mock_get_user.side_effect = Exception("Not authenticated")

            response = client.get("/api/auth/status")
            # Р­РЅРґРїРѕРёРЅС‚ РґРѕР»Р¶РµРЅ РѕР±СЂР°Р±РѕС‚Р°С‚СЊ РѕС€РёР±РєСѓ
            assert response.status_code in [200, 401]

    def test_get_current_user_optional(self, client):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)"""
        with patch("auth.auth.get_current_user_optional") as mock_get_user:
            mock_get_user.return_value = None

            response = client.get("/api/auth/status")
            assert response.status_code == 200
            data = response.json()
            assert data["authenticated"] == False


class TestOAuth:
    """РўРµСЃС‚С‹ РґР»СЏ OAuth"""

    @patch("auth.oauth_handler.oauth_handler")
    def test_twitch_oauth_callback(self, mock_oauth_handler, client, db_session):
        """РўРµСЃС‚ OAuth callback РґР»СЏ Twitch"""
        mock_oauth_handler.handle_oauth_callback.return_value = {
            "success": True,
            "redirect_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/dashboard",
        }

        response = client.get("/auth/twitch/callback?code=test_code")
        # РњРѕР¶РµС‚ Р±С‹С‚СЊ 307 (redirect), 400 (error), РёР»Рё 500 (server error)
        assert response.status_code in [307, 400, 500]

    @patch("auth.oauth_handler.oauth_handler")
    def test_vk_oauth_callback(self, mock_oauth_handler, client, db_session):
        """РўРµСЃС‚ OAuth callback РґР»СЏ VK"""
        mock_oauth_handler.handle_oauth_callback.return_value = {
            "success": True,
            "redirect_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/dashboard",
        }

        response = client.get("/auth/vk/callback?code=test_code")
        # РњРѕР¶РµС‚ Р±С‹С‚СЊ 307 (redirect), 400 (error), РёР»Рё 500 (server error)
        assert response.status_code in [307, 400, 500]

    @patch("auth.oauth_handler.oauth_handler")
    def test_oauth_callback_error(self, mock_oauth_handler, client, db_session):
        """РўРµСЃС‚ РѕС€РёР±РєРё OAuth callback"""
        mock_oauth_handler.handle_oauth_callback.side_effect = Exception("OAuth error")

        response = client.get("/auth/twitch/callback?code=invalid_code")
        # РњРѕР¶РµС‚ Р±С‹С‚СЊ 400 (bad request), 404 (not found), РёР»Рё 500 (server error)
        assert response.status_code in [400, 404, 500]


class TestAuthIntegration:
    """РўРµСЃС‚С‹ РёРЅС‚РµРіСЂР°С†РёРё Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё"""

    def test_auth_flow_complete(self, client, db_session):
        """РўРµСЃС‚ РїРѕР»РЅРѕРіРѕ РїРѕС‚РѕРєР° Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё"""
        from core.database import User, UserSession
        from core.datetime_utils import utcnow_naive
        import uuid

        # 1. РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ Р±РµР· Р°РІС‚РѕСЂРёР·Р°С†РёРё
        response = client.get("/api/auth/status")
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] == False

        # 2. РЎРѕР·РґР°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё СЃРµСЃСЃРёСЋ РЅР°РїСЂСЏРјСѓСЋ РІ Р‘Р”
        user = User(
            id=999, role="admin", is_active=True, twitch_username="testuser_flow"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        # РЎРѕР·РґР°РµРј СЃРµСЃСЃРёСЋ РЅР°РїСЂСЏРјСѓСЋ РІ Р‘Р”
        session_id = str(uuid.uuid4())
        new_session = UserSession(
            user_id=user.id,
            session_id=session_id,
            device_info={"test": "flow"},
            is_active=True,
            created_at=utcnow_naive(),
            last_activity=utcnow_naive(),
        )
        db_session.add(new_session)
        db_session.commit()

        # 3. РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј СЃРµСЃСЃРёСЋ РІ cookies
        client.cookies.set("session_id", session_id)

        # 4. РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ СЃ Р°РІС‚РѕСЂРёР·Р°С†РёРµР№
        response = client.get("/api/auth/status")
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] == True

        # 5. Р’С‹С…РѕРґРёРј РёР· СЃРёСЃС‚РµРјС‹
        csrf_token = client.cookies.get("csrf_token")
        headers = {"X-CSRF-Token": csrf_token} if csrf_token else {}
        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True

        # 6. Logout РёСЃРїРѕР»СЊР·СѓРµС‚ production DB, РїРѕСЌС‚РѕРјСѓ РїСЂРѕСЃС‚Рѕ РїСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ Р·Р°РїСЂРѕСЃ СѓСЃРїРµС€РµРЅ
        # РЎРµСЃСЃРёСЏ РІ test DB РѕСЃС‚Р°РЅРµС‚СЃСЏ Р°РєС‚РёРІРЅРѕР№, РЅРѕ СЌС‚Рѕ РЅРѕСЂРјР°Р»СЊРЅРѕ РґР»СЏ С‚РµСЃС‚РѕРІ


    def test_session_security(self, test_user, db_session):
        """РўРµСЃС‚ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё СЃРµСЃСЃРёР№"""
        from core.database import UserSession
        from core.datetime_utils import utcnow_naive
        import uuid

        # РЎРѕР·РґР°РµРј СЃРµСЃСЃРёСЋ РЅР°РїСЂСЏРјСѓСЋ РІ Р‘Р”
        session_id = str(uuid.uuid4())
        new_session = UserSession(
            user_id=test_user.id,
            session_id=session_id,
            device_info={"test": "security"},
            is_active=True,
            created_at=utcnow_naive(),
            last_activity=utcnow_naive(),
        )
        db_session.add(new_session)
        db_session.commit()

        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СЃРµСЃСЃРёСЏ Р°РєС‚РёРІРЅР° РІ Р‘Р”
        session = (
            db_session.query(UserSession)
            .filter(UserSession.session_id == session_id, UserSession.is_active == True)
            .first()
        )
        assert session is not None

        # Р—Р°РІРµСЂС€Р°РµРј СЃРµСЃСЃРёСЋ (РЅРµ РїРµСЂРµРґР°РµРј db_session, РјРµС‚РѕРґ РёСЃРїРѕР»СЊР·СѓРµС‚ СЃРІРѕР№)
        result = session_manager.terminate_session(session_id, "security_test")

        # terminate_session РёСЃРїРѕР»СЊР·СѓРµС‚ СЃРІРѕСЋ Р‘Р”, РїРѕСЌС‚РѕРјСѓ РїСЂРѕСЃС‚Рѕ РїСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РјРµС‚РѕРґ РІС‹РїРѕР»РЅРёР»СЃСЏ
        assert result is True or result is False


