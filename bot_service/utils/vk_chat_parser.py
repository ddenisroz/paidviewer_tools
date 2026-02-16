"""
Helpers to parse VK Live chat payloads into text, emotes, and badge URLs.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def normalize_parts(parts: Optional[List[Dict[str, Any]]], data_blocks: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Normalize VK message payloads into `parts` shape.

    VK Live may send either `parts` (objects with text/smile/mention/link)
    or `data` blocks (editor-like payload). We convert data blocks to text parts
    so downstream parsing stays consistent.
    """
    if parts:
        return parts

    normalized: List[Dict[str, Any]] = []
    if not data_blocks:
        return normalized

    for block in data_blocks:
        if block.get("type") != "text":
            continue
        content = block.get("content", "")
        if isinstance(content, str) and content.startswith("["):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, list) and parsed:
                    content = parsed[0]
            except Exception:
                pass
        normalized.append({"text": {"content": str(content)}})

    return normalized


def extract_vk_badge_urls(author: Dict[str, Any]) -> Optional[List[str]]:
    badges = author.get("badges") or []
    if not isinstance(badges, list):
        return None

    urls: List[str] = []
    for badge in badges:
        if isinstance(badge, str):
            urls.append(badge)
            continue
        if not isinstance(badge, dict):
            continue
        url = (
            badge.get("smallUrl")
            or badge.get("small_url")
            or badge.get("url")
            or badge.get("icon")
            or badge.get("small")
            or badge.get("image")
        )
        if url:
            urls.append(url)

    return urls or None


def extract_smile_url(smile: Dict[str, Any]) -> Optional[str]:
    url = (
        smile.get("smallUrl")
        or smile.get("small_url")
        or smile.get("url")
        or smile.get("icon")
        or smile.get("small")
        or smile.get("src")
    )
    if url:
        return url

    smile_id = smile.get("id") or smile.get("smile_id") or smile.get("uuid")
    if smile_id:
        return f"https://images.live.vkvideo.ru/smile/{smile_id}/icon/size/small"
    return None


def build_message_text_and_emotes(parts: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
    message_text = ""
    emotes: List[Dict[str, Any]] = []
    cursor = 0

    for part in parts:
        if "text" in part:
            content = part["text"].get("content", "")
            content = str(content)
            message_text += content
            cursor += len(content)
            continue

        if "mention" in part:
            mention = f"@{part['mention'].get('nick', '')}"
            message_text += mention
            cursor += len(mention)
            continue

        if "smile" in part:
            smile = part.get("smile") or {}
            if not isinstance(smile, dict):
                continue
            name = smile.get("name") or smile.get("baseName") or "smile"
            placeholder = f":{name}:"
            start = cursor
            end = start + len(placeholder) - 1
            message_text += placeholder
            cursor += len(placeholder)

            url = extract_smile_url(smile)
            if url:
                emotes.append({
                    "id": smile.get("id") or name,
                    "name": name,
                    "url": url,
                    "start": start,
                    "end": end
                })
            continue

        if "link" in part:
            link_url = part["link"].get("url", "")
            if link_url:
                message_text += link_url
                cursor += len(link_url)

    return message_text, emotes
