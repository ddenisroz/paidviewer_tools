from types import SimpleNamespace

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
