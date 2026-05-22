from types import SimpleNamespace

import pytest

from services.tts_handler_service import TTSHandlerService


def test_channel_points_mode_falls_back_to_all_messages_when_reward_missing():
    service = TTSHandlerService()
    settings = SimpleNamespace(tts_reward_ids={})

    assert service._validate_channel_points_mode(settings, "twitch", reward_id=None) is True


def test_channel_points_mode_still_requires_matching_reward_when_configured():
    service = TTSHandlerService()
    settings = SimpleNamespace(tts_reward_ids={"twitch": "reward-123"})

    assert service._validate_channel_points_mode(settings, "twitch", reward_id=None) is False
    assert service._validate_channel_points_mode(settings, "twitch", reward_id="reward-999") is False
    assert service._validate_channel_points_mode(settings, "twitch", reward_id="reward-123") is True


@pytest.mark.asyncio
async def test_forbidden_phrase_matches_inside_message():
    service = TTSHandlerService()
    async def get_filtered_words(_user_id):
        return [
            {"word": "123", "platform": "all"},
        ]

    tts_service = SimpleNamespace(get_filtered_words=get_filtered_words)

    assert await service._match_filtered_word(tts_service, 1, "twitch", "test 123") == "123"
    assert await service._match_filtered_word(tts_service, 1, "twitch", "test123") == "123"


def test_memealerts_streamer_id_prefers_jwt_id_for_bonus_payload():
    from services.memealerts_service import MemeAlertsService

    assert (
        MemeAlertsService._resolve_streamer_id(
            {"id": "streamer-id", "tid": "token-record-id"},
            "old-local-token-id",
        )
        == "streamer-id"
    )
