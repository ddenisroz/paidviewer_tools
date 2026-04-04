"""Version helpers for the self-hosted worker-agent."""

from __future__ import annotations

AGENT_VERSION = "1.0.0"


def parse_version(value: str) -> tuple[int, ...]:
    cleaned = str(value or "").strip()
    if not cleaned:
        return tuple()
    parts: list[int] = []
    for token in cleaned.split("."):
        digits = "".join(ch for ch in token if ch.isdigit())
        parts.append(int(digits or "0"))
    return tuple(parts)


def is_version_compatible(current_version: str, required_version: str) -> bool:
    required_parts = parse_version(required_version)
    current_parts = parse_version(current_version)
    if not required_parts:
        return True
    if not current_parts:
        return False

    max_len = max(len(required_parts), len(current_parts))
    normalized_required = required_parts + (0,) * (max_len - len(required_parts))
    normalized_current = current_parts + (0,) * (max_len - len(current_parts))
    return normalized_current >= normalized_required
