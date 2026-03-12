from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from repositories.tts_settings_repository import TTSSettingsRepository
from services.tts.tts_service import (
    BlockTargetNotFoundError,
    BlockTargetVerificationUnavailableError,
    TTSService,
)


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def tts_service(mock_db):
    return TTSService(mock_db)


@pytest.mark.asyncio
async def test_synthesize_success(tts_service):
    user_data = {"id": 1, "username": "test_user", "is_admin": False}
    text = "Hello world"

    tts_service.settings_repo = MagicMock(spec=TTSSettingsRepository)
    tts_service.audio_repo = MagicMock()

    mock_settings = MagicMock()
    tts_service.settings_repo.get_or_create.return_value = mock_settings
    tts_service.settings_repo.get_settings_dict.return_value = {"enable_twitch": True}

    mock_audio = MagicMock()
    mock_audio.website_volume = 50
    tts_service.audio_repo.get_or_create.return_value = mock_audio

    with patch("services.advanced_rate_limiter.advanced_rate_limiter.check_tts_rate_limit", new_callable=AsyncMock) as mock_limit:
        mock_limit.return_value = {"allowed": True}

        with patch("services.tts.tts_service.get_memory_tts_queue") as mock_get_queue:
            mock_queue = AsyncMock()
            mock_queue.add_task.return_value = "task-123"
            mock_get_queue.return_value = mock_queue

            with patch("services.advanced_rate_limiter.advanced_rate_limiter.add_tts_request", new_callable=AsyncMock):
                result = await tts_service.synthesize(text, user_data)

    assert result["success"] is True
    assert result["task_id"] == "task-123"
    mock_queue.add_task.assert_called_once()


@pytest.mark.asyncio
async def test_synthesize_rate_limited(tts_service):
    user_data = {"id": 1, "username": "test_user"}

    with patch("services.advanced_rate_limiter.advanced_rate_limiter.check_tts_rate_limit", new_callable=AsyncMock) as mock_limit:
        mock_limit.return_value = {"allowed": False}

        result = await tts_service.synthesize("Hello world", user_data)

    assert result["success"] is False
    assert result["error"] == "Rate limit exceeded"


@pytest.mark.asyncio
async def test_update_settings_version_conflict(tts_service):
    tts_service.settings_repo = MagicMock()

    mock_settings = MagicMock()
    mock_settings.version = 2
    tts_service.settings_repo.get_or_create.return_value = mock_settings

    result = await tts_service.save_tts_settings(user_id=1, client_version=1)

    assert result["success"] is False
    assert result["error"] == "Version conflict"
    assert result["current_version"] == 2


@pytest.mark.asyncio
async def test_enable_tts_success(tts_service):
    tts_service.user_repo = MagicMock()
    tts_service.token_repo = MagicMock()

    mock_user = MagicMock()
    mock_user.twitch_username = "test_channel"
    tts_service.user_repo.get_by_id.return_value = mock_user
    tts_service.token_repo.get_all_by_user.return_value = []

    with patch("services.tts.tts_service.get_connection_manager") as mock_cm_getter:
        mock_cm = MagicMock()
        mock_cm_getter.return_value = mock_cm

        result = await tts_service.enable_tts(user_id=1)

    assert result is True
    tts_service.user_repo.update.assert_called_with(mock_user, {"tts_enabled": True})
    mock_cm.enable_tts_for_channel.assert_called_with("test_channel")


@pytest.mark.asyncio
async def test_ensure_block_target_exists_accepts_known_vk_chat_user(tts_service):
    tts_service.user_repo = MagicMock()
    tts_service.chat_repo = MagicMock()
    tts_service.user_repo.get_by_vk_username.return_value = None
    tts_service.user_repo.get_by_vk_channel_name.return_value = None
    tts_service.chat_repo.author_exists_in_channel.return_value = True

    resolved = await tts_service.ensure_block_target_exists(
        user_id=1,
        channel_name="owner_channel",
        platform="vk",
        username="@ViewerName",
    )

    assert resolved == "viewername"


@pytest.mark.asyncio
async def test_ensure_block_target_exists_rejects_unknown_twitch_user(tts_service):
    tts_service.user_repo = MagicMock()
    tts_service.chat_repo = MagicMock()
    tts_service.chat_repo.author_exists_in_channel.return_value = False
    tts_service.user_repo.get_by_twitch_username.return_value = None

    with patch.object(tts_service, "_resolve_twitch_username_exists", AsyncMock(return_value=False)):
        with pytest.raises(BlockTargetNotFoundError):
            await tts_service.ensure_block_target_exists(
                user_id=1,
                channel_name="owner_channel",
                platform="twitch",
                username="ghost_user",
            )


@pytest.mark.asyncio
async def test_ensure_block_target_exists_returns_503_when_verification_unavailable(tts_service):
    tts_service.user_repo = MagicMock()
    tts_service.chat_repo = MagicMock()
    tts_service.chat_repo.author_exists_in_channel.return_value = False
    tts_service.user_repo.get_by_twitch_username.return_value = None

    with patch.object(tts_service, "_resolve_twitch_username_exists", AsyncMock(return_value=None)):
        with pytest.raises(BlockTargetVerificationUnavailableError):
            await tts_service.ensure_block_target_exists(
                user_id=1,
                channel_name="owner_channel",
                platform="twitch",
                username="ghost_user",
            )
