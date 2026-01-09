# bot_service/tests/test_tts_service.py
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.orm import Session

from services.tts.tts_service import TTSService
from repositories.tts_settings_repository import TTSSettingsRepository
from services.advanced_rate_limiter import advanced_rate_limiter
from services.user_identity_service import UserIdentityService

@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)

@pytest.fixture
def tts_service(mock_db):
    return TTSService(mock_db)

@pytest.mark.asyncio
async def test_synthesize_success(tts_service, mock_db):
    """Test successful synthesis request"""
    # Arrange
    user_data = {"id": 1, "username": "test_user", "is_admin": False}
    text = "Hello world"
    
    # Mock Repositories
    tts_service.settings_repo = MagicMock(spec=TTSSettingsRepository)
    tts_service.audio_repo = MagicMock()
    
    mock_settings = MagicMock()
    mock_settings.enable_twitch = True
    tts_service.settings_repo.get_or_create.return_value = mock_settings
    tts_service.settings_repo.get_settings_dict.return_value = {"enable_twitch": True}
    
    mock_audio = MagicMock()
    mock_audio.website_volume = 50
    tts_service.audio_repo.get_or_create.return_value = mock_audio

    # Mock Rate Limiter
    with patch('services.advanced_rate_limiter.advanced_rate_limiter.check_tts_rate_limit', new_callable=AsyncMock) as mock_limit:
        mock_limit.return_value = {"allowed": True}
        
        with patch('services.tts.tts_service.get_memory_tts_queue') as mock_get_queue:
            mock_queue = AsyncMock()
            mock_queue.add_task.return_value = "task-123"
            mock_get_queue.return_value = mock_queue
            
            with patch('services.advanced_rate_limiter.advanced_rate_limiter.add_tts_request', new_callable=AsyncMock):
                
                # Act
                result = await tts_service.synthesize(text, user_data)
                
                # Assert
                assert result["success"] is True
                assert result["task_id"] == "task-123"
                mock_queue.add_task.assert_called_once()


@pytest.mark.asyncio
async def test_synthesize_rate_limited(tts_service):
    """Test synthesis when rate limit exceeded"""
    user_data = {"id": 1, "username": "test_user"}
    text = "Hello world"
    
    with patch('services.advanced_rate_limiter.advanced_rate_limiter.check_tts_rate_limit', new_callable=AsyncMock) as mock_limit:
        mock_limit.return_value = {"allowed": False}
        
        result = await tts_service.synthesize(text, user_data)
        
        assert result["success"] is False
        assert result["error"] == "Rate limit exceeded"

@pytest.mark.asyncio
async def test_update_settings_version_conflict(tts_service):
    """Test updating settings with version conflict"""
    tts_service.settings_repo = MagicMock()
    
    mock_settings = MagicMock()
    mock_settings.version = 2
    tts_service.settings_repo.get_or_create.return_value = mock_settings
    
    result = await tts_service.save_tts_settings(
        user_id=1,
        client_version=1 # Old version
    )
    
    assert result["success"] is False
    assert result["error"] == "Version conflict"
    assert result["current_version"] == 2

@pytest.mark.asyncio
async def test_enable_tts_success(tts_service, mock_db):
    """Test enabling TTS for user"""
    tts_service.user_repo = MagicMock()
    tts_service.token_repo = MagicMock()
    
    mock_user = MagicMock()
    mock_user.twitch_username = "test_channel"
    tts_service.user_repo.get_by_id.return_value = mock_user
    
    tts_service.token_repo.get_all_by_user.return_value = []
    
    with patch('services.tts.tts_service.get_connection_manager') as mock_cm_getter:
        mock_cm = MagicMock()
        mock_cm_getter.return_value = mock_cm
        
        result = await tts_service.enable_tts(user_id=1)
        
        assert result is True
        assert result is True
        # Verify repository update was called instead of checking object property
        # because mock repo doesn't actually update the mock user object
        tts_service.user_repo.update.assert_called_with(mock_user, {'tts_enabled': True})
        mock_cm.enable_tts_for_channel.assert_called_with("test_channel")
