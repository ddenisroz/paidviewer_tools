from datetime import datetime, timedelta
from types import SimpleNamespace

from services.command_cooldown_store import CommandCooldownStore
from services.command_service import CommandService


class _FakeRedis:
    def __init__(self) -> None:
        self.entries: dict[str, tuple[int, str]] = {}

    def exists(self, key: str) -> int:
        return 1 if key in self.entries else 0

    def setex(self, key: str, ttl: int, value: str) -> bool:
        self.entries[key] = (ttl, value)
        return True


def _command(**overrides):
    payload = {
        "id": 42,
        "cooldown_seconds": 30,
        "platforms": "twitch",
        "channel_name": "demo_channel",
        "user_id": 7,
        "command_name": "hello",
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def test_command_service_uses_redis_cooldown_store():
    fake_redis = _FakeRedis()
    service = CommandService(cooldown_store=CommandCooldownStore(redis_client=fake_redis))
    command = _command()

    assert service.check_cooldown(command, "viewer_1") is True

    service.update_cooldown(command, "viewer_1")

    assert service.check_cooldown(command, "viewer_1") is False

    cooldown_key = next(iter(fake_redis.entries))
    assert "platform:twitch" in cooldown_key
    assert "channel:demo_channel" in cooldown_key
    assert "command:42" in cooldown_key
    assert "viewer:viewer_1" in cooldown_key


def test_command_cooldown_store_memory_fallback_expires_entries(monkeypatch):
    now = datetime(2026, 4, 5, 12, 0, 0)

    def _now():
        return now

    monkeypatch.setattr("services.command_cooldown_store.utcnow_naive", _now)

    store = CommandCooldownStore(redis_url="")
    service = CommandService(cooldown_store=store)
    command = _command(cooldown_seconds=10, platforms="vk", channel_name="vk_demo")

    service.update_cooldown(command, "viewer_2")

    assert service.check_cooldown(command, "viewer_2") is False

    now = now + timedelta(seconds=11)

    assert service.check_cooldown(command, "viewer_2") is True
