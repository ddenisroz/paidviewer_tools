# bot_service/services/memealerts_service.py
"""
MemeAlerts service helpers for commands and API.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx
import jwt
from sqlalchemy.orm import Session

from repositories.user_token_repository import UserTokenRepository

logger = logging.getLogger(__name__)

MEMEALERTS_API_BASE = "https://memealerts.com/api"


class MemeAlertsService:
    def __init__(self, db: Session):
        self.db = db
        self.token_repo = UserTokenRepository(db)

    def _get_token(self, user_id: int) -> Tuple[str, Optional[str]]:
        from core.token_encryption import decrypt_token
        token = self.token_repo.get_by_user_and_platform(user_id, "memealerts")
        if not token or not token.access_token:
            raise ValueError("MemeAlerts not connected")
        return decrypt_token(token.access_token), token.platform_user_id

    @staticmethod
    def _decode_token(token: str) -> Dict[str, Any]:
        try:
            return jwt.decode(token, options={"verify_signature": False})
        except jwt.DecodeError:
            return {}

    async def _request(
        self,
        method: str,
        endpoint: str,
        access_token: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        url = f"{MEMEALERTS_API_BASE}{endpoint}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.request(method, url, params=params, json=json, headers=headers)

    async def _resolve_user_id(self, access_token: str, nickname_or_id: str) -> Optional[str]:
        if nickname_or_id.isdigit():
            return nickname_or_id

        nickname = nickname_or_id.lstrip("@")
        if not nickname:
            return None

        params_options = [
            {"nickname": nickname},
            {"name": nickname},
            {"query": nickname},
        ]

        for params in params_options:
            try:
                response = await self._request("GET", "/user/find", access_token, params=params)
                if response.status_code != 200:
                    continue
                payload = response.json()
                users = []
                if isinstance(payload, list):
                    users = payload
                elif isinstance(payload, dict):
                    for key in ("data", "items", "users", "results"):
                        if isinstance(payload.get(key), list):
                            users = payload.get(key)
                            break
                if users:
                    first = users[0] or {}
                    user_id = first.get("id") or first.get("userId") or first.get("uid")
                    if user_id:
                        return str(user_id)
            except Exception as e:
                logger.warning(f"MemeAlerts user lookup failed: {e}")

        return None

    async def grant_coins(
        self,
        user_id: int,
        nickname_or_id: str,
        amount: int,
        *,
        platform: str,
        channel_name: str,
        issued_by: str,
        source: str = "command",
    ) -> Dict[str, Any]:
        try:
            access_token, platform_user_id = self._get_token(user_id)
        except ValueError as exc:
            return {"success": False, "error": str(exc)}
        decoded = self._decode_token(access_token)
        streamer_id = decoded.get("id") or platform_user_id

        if not streamer_id:
            return {"success": False, "error": "Streamer ID not found in token"}

        target_user_id = await self._resolve_user_id(access_token, nickname_or_id)
        if not target_user_id:
            return {"success": False, "error": "User not found in MemeAlerts"}

        payload = {
            "userId": target_user_id,
            "streamerId": streamer_id,
            "value": int(amount),
        }

        response = await self._request("POST", "/user/give-bonus", access_token, json=payload)
        if response.status_code not in (200, 201):
            return {
                "success": False,
                "error": f"API Error: {response.status_code}",
                "detail": response.text,
            }

        return {
            "success": True,
            "target_user_id": target_user_id,
            "nickname": nickname_or_id,
            "amount": amount,
            "source": source,
            "platform": platform,
            "channel_name": channel_name,
            "issued_by": issued_by,
            "data": response.json(),
        }

    async def fetch_history(self, user_id: int, limit: int = 50) -> Dict[str, Any]:
        try:
            access_token, _ = self._get_token(user_id)
        except ValueError as exc:
            return {"success": False, "error": str(exc), "grants": [], "purchases": [], "unknown": []}

        transactions = []
        for endpoint in ("/user/transactions", "/user/history"):
            try:
                response = await self._request("GET", endpoint, access_token, params={"limit": limit})
                if response.status_code == 200:
                    payload = response.json()
                    transactions = self._extract_list(payload)
                    if transactions:
                        break
            except Exception as e:
                logger.warning(f"MemeAlerts history fetch failed: {e}")

        grants, purchases, unknown = self._split_transactions(transactions)

        # Fallback: try supporters list as purchases if no purchases were found
        if not purchases:
            supporters = await self._fetch_supporters(access_token, limit)
            purchases = self._normalize_supporters(supporters)

        return {
            "success": True,
            "grants": grants,
            "purchases": purchases,
            "unknown": unknown,
        }

    async def _fetch_supporters(self, access_token: str, limit: int) -> List[Dict[str, Any]]:
        for endpoint in ("/user/supporters", "/supporters"):
            try:
                response = await self._request("GET", endpoint, access_token, params={"limit": limit})
                if response.status_code == 200:
                    payload = response.json()
                    return self._extract_list(payload)
            except Exception as e:
                logger.warning(f"MemeAlerts supporters fetch failed: {e}")
        return []

    @staticmethod
    def _extract_list(payload: Any) -> List[Dict[str, Any]]:
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("data", "items", "list", "history", "transactions", "results"):
                if isinstance(payload.get(key), list):
                    return payload.get(key)
            data = payload.get("data")
            if isinstance(data, dict):
                for key in ("items", "list", "history", "transactions"):
                    if isinstance(data.get(key), list):
                        return data.get(key)
        return []

    @staticmethod
    def _normalize_transaction(item: Dict[str, Any]) -> Dict[str, Any]:
        user_info = item.get("user") or item.get("viewer") or {}
        return {
            "id": item.get("id") or item.get("transactionId") or item.get("uuid"),
            "type": item.get("type") or item.get("action") or item.get("kind"),
            "amount": item.get("value") or item.get("amount") or item.get("coins") or item.get("sum"),
            "user_id": item.get("userId") or item.get("targetUserId") or user_info.get("id"),
            "user_name": item.get("userName") or item.get("nickname") or user_info.get("nickname"),
            "created_at": item.get("createdAt") or item.get("created_at") or item.get("date"),
            "raw": item,
        }

    def _split_transactions(
        self,
        transactions: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        grants: List[Dict[str, Any]] = []
        purchases: List[Dict[str, Any]] = []
        unknown: List[Dict[str, Any]] = []

        for item in transactions:
            normalized = self._normalize_transaction(item)
            action = str(normalized.get("type") or "").lower()
            if any(key in action for key in ("bonus", "grant", "give", "reward")):
                grants.append(normalized)
            elif any(key in action for key in ("purchase", "buy", "donat", "support")):
                purchases.append(normalized)
            else:
                unknown.append(normalized)

        return grants, purchases, unknown

    @staticmethod
    def _normalize_supporters(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        purchases: List[Dict[str, Any]] = []
        for item in items:
            user_info = item.get("user") or item.get("viewer") or {}
            purchases.append(
                {
                    "id": item.get("id"),
                    "type": "support",
                    "amount": item.get("amount") or item.get("sum") or item.get("total"),
                    "user_id": user_info.get("id") or item.get("userId"),
                    "user_name": user_info.get("nickname") or item.get("userName"),
                    "created_at": item.get("createdAt") or item.get("updatedAt"),
                    "raw": item,
                }
            )
        return purchases
