# bot_service/integrations/vk/__init__.py
"""
VK Live Integration Layer.

TODO: Вынести логику из api/vk_api.py и platforms/vk_live_bot.py
"""

from .client import VKClient

__all__ = ["VKClient"]
