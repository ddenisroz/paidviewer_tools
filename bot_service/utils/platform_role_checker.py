"""Platform-specific role helpers for Twitch and VK Live."""

import logging
from typing import Any

logger = logging.getLogger("bot_service")


class PlatformRoleChecker:
    """Resolve normalized role lists across supported chat platforms."""

    @staticmethod
    def get_twitch_roles(author_data: Any, channel_name: str) -> list[str]:
        """Return normalized Twitch roles for a chat author."""

        roles: list[str] = []

        try:
            if getattr(author_data, "is_broadcaster", False):
                roles.extend(["broadcaster", "owner"])

            author_name = getattr(author_data, "name", "")
            if author_name and author_name.lower() == channel_name.lower():
                if "broadcaster" not in roles:
                    roles.append("broadcaster")
                if "owner" not in roles:
                    roles.append("owner")

            if getattr(author_data, "is_mod", False):
                roles.append("moderator")

            if getattr(author_data, "is_vip", False):
                roles.append("vip")

            if getattr(author_data, "is_subscriber", False):
                roles.append("subscriber")

            badges = getattr(author_data, "badges", []) or []
            for badge in badges:
                if "founder" in str(badge).lower():
                    roles.append("founder")
                    break

            if not roles:
                roles.append("viewer")

            logger.debug("[TWITCH ROLES] %s: %s", author_name or "unknown", roles)

        except Exception as exc:
            logger.error("Error getting Twitch roles: %s", exc)
            roles = ["viewer"]

        return list(dict.fromkeys(roles))

    @staticmethod
    def get_vk_roles(author_data: dict[str, Any], channel_id: str) -> list[str]:
        """Return normalized VK Live roles for a chat author."""

        del channel_id  # Reserved for future upstream parity.
        roles: list[str] = []

        try:
            if author_data.get("is_owner", False):
                roles.extend(["owner", "broadcaster"])

            if author_data.get("is_moderator", False):
                roles.append("moderator")

            if not roles:
                roles.append("viewer")

            logger.debug("[VK ROLES] %s: %s", author_data.get("name", "unknown"), roles)

        except Exception as exc:
            logger.error("Error getting VK roles: %s", exc)
            roles = ["viewer"]

        return list(dict.fromkeys(roles))

    @staticmethod
    def is_broadcaster(roles: list[str]) -> bool:
        """Return whether the role list belongs to a broadcaster or owner."""

        return "broadcaster" in roles or "owner" in roles

    @staticmethod
    def has_mod_access(roles: list[str]) -> bool:
        """Return whether the role list has moderator-level access or higher."""

        return any(role in roles for role in ["broadcaster", "owner", "moderator"])

    @staticmethod
    def has_vip_access(roles: list[str]) -> bool:
        """Return whether the role list has VIP-level access or higher."""

        return any(role in roles for role in ["broadcaster", "owner", "moderator", "vip", "founder"])
