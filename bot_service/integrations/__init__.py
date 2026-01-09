# bot_service/integrations/__init__.py
"""
Integrations Layer - изолированный слой для работы с внешними сервисами.

Этот слой инкапсулирует всю логику взаимодействия с внешними API:
- Twitch API, OAuth, EventSub
- VK Live API
- DonationAlerts API
- TTS Engines (Google, F5)

Ключевые принципы:
1. Ошибки внешних сервисов НЕ роняют приложение
2. Retry логика и таймауты настроены
3. Токены обновляются автоматически
4. Каждая интеграция полностью изолирована
"""

from .twitch import TwitchClient
from .vk import VKClient
from .donationalerts import DonationAlertsClient

__all__ = [
    "TwitchClient",
    "VKClient",
    "DonationAlertsClient",
]
