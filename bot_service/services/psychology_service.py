import logging
import aiohttp
from datetime import timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from core.database import ChatMessage
from core.datetime_utils import utcnow_naive
from core.config import settings
from repositories.psychology_repository import PsychologyRepository
from repositories.chat_message_repository import ChatMessageRepository
from repositories.user_repository import UserRepository
logger = logging.getLogger(__name__)

class PsychologyService:
    """РЎРµСЂРІРёСЃ РґР»СЏ РїСЃРёС…РѕР»РѕРіРёС‡РµСЃРєРѕРіРѕ Р°РЅР°Р»РёР·Р° РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РЅР° РѕСЃРЅРѕРІРµ РёС… СЃРѕРѕР±С‰РµРЅРёР№"""
    _analysis_in_progress = False
    _last_analysis_time: dict = {}

    def __init__(self, db: Session):
        self.db = db

    async def analyze_user_psychology(self, target_username: str, platform: str, analyzed_by_user_id: int, analyzed_by_username: str, channel_name: str) -> Optional[str]:
        """
        РђРЅР°Р»РёР·РёСЂСѓРµС‚ РїСЃРёС…РѕР»РѕРіРёС‡РµСЃРєРёР№ РїРѕСЂС‚СЂРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅР° РѕСЃРЅРѕРІРµ РµРіРѕ СЃРѕРѕР±С‰РµРЅРёР№
        
        Args:
            target_username: РќРёРє РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ Р°РЅР°Р»РёР·Р°
            platform: РџР»Р°С‚С„РѕСЂРјР° (twitch/vk)
            analyzed_by_user_id: ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ, РєРѕС‚РѕСЂС‹Р№ Р·Р°РїСЂРѕСЃРёР» Р°РЅР°Р»РёР·
            analyzed_by_username: РќРёРє РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ, РєРѕС‚РѕСЂС‹Р№ Р·Р°РїСЂРѕСЃРёР» Р°РЅР°Р»РёР·
            
        Returns:
            Р РµР·СѓР»СЊС‚Р°С‚ Р°РЅР°Р»РёР·Р° РёР»Рё None РїСЂРё РѕС€РёР±РєРµ
        """
        try:
            current_time = utcnow_naive()
            if analyzed_by_user_id in self.__class__._last_analysis_time:
                time_diff = current_time - self.__class__._last_analysis_time[analyzed_by_user_id]
                if time_diff.total_seconds() < 30:
                    remaining = 30 - int(time_diff.total_seconds())
                    return f'[TIMEOUT] РџРѕРґРѕР¶РґРёС‚Рµ {remaining} СЃРµРєСѓРЅРґ РїРµСЂРµРґ СЃР»РµРґСѓСЋС‰РёРј Р°РЅР°Р»РёР·РѕРј'
            if self.__class__._analysis_in_progress:
                return '[REFRESH] РђРЅР°Р»РёР· СѓР¶Рµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ, РїРѕРґРѕР¶РґРёС‚Рµ...'
            if not self._check_database_health():
                return '[WARN] Р‘Р°Р·Р° РґР°РЅРЅС‹С… РїРµСЂРµРіСЂСѓР¶РµРЅР°, Р°РЅР°Р»РёР· РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ'
            self.__class__._analysis_in_progress = True
            self.__class__._last_analysis_time[analyzed_by_user_id] = current_time
            target_username = (target_username or '').strip().lstrip('@')
            if not target_username:
                self.__class__._analysis_in_progress = False
                return '[ERROR] РЈРєР°Р¶РёС‚Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ Р°РЅР°Р»РёР·Р°'
            channel_limit = settings.chat_analysis_channel_limit
            global_limit = settings.chat_analysis_global_limit
            min_messages = settings.chat_analysis_min_messages
            (channel_messages, global_messages) = self._get_user_messages(owner_user_id=analyzed_by_user_id, username=target_username, platform=platform, channel_name=channel_name, channel_limit=channel_limit, global_limit=global_limit)
            if not global_messages:
                self.__class__._analysis_in_progress = False
                return f'[ERROR] РќРµ РЅР°Р№РґРµРЅРѕ СЃРѕРѕР±С‰РµРЅРёР№ РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ {target_username}'
            (channel_text, channel_count) = self._prepare_messages_for_analysis(channel_messages)
            (global_text, global_count) = self._prepare_messages_for_analysis(global_messages)
            if global_count < min_messages:
                self.__class__._analysis_in_progress = False
                return f'[ERROR] РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃРѕРѕР±С‰РµРЅРёР№ РґР»СЏ Р°РЅР°Р»РёР·Р° (РЅР°Р№РґРµРЅРѕ: {global_count}, РЅСѓР¶РЅРѕ РјРёРЅРёРјСѓРј {min_messages})'
            if not channel_text and (not global_text):
                self.__class__._analysis_in_progress = False
                return '[ERROR] РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРіРѕС‚РѕРІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёСЏ РґР»СЏ Р°РЅР°Р»РёР·Р°'
            analysis_result = await self._request_ai_analysis(target_username=target_username, platform=platform, channel_name=channel_name, channel_text=channel_text, channel_count=channel_count, global_text=global_text, global_count=global_count)
            if analysis_result:
                if analysis_result.startswith('[ERROR]'):
                    self.__class__._analysis_in_progress = False
                    return analysis_result
                if settings.chat_analysis_save_results:
                    self._save_analysis_result(target_username, platform, analyzed_by_user_id, analyzed_by_username, analysis_result, global_count)
                    logger.info(f'Psychology analysis saved for {target_username}')
                else:
                    logger.info(f'Psychology analysis completed for {target_username} (not saved to DB)')
                self.__class__._analysis_in_progress = False
                return analysis_result
            else:
                self.__class__._analysis_in_progress = False
                return '[ERROR] РћС€РёР±РєР° РїСЂРё Р°РЅР°Р»РёР·Рµ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.'
        except Exception:
            logger.exception('Error in analyze_user_psychology')
            self.__class__._analysis_in_progress = False
            return '[ERROR] РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР° РїСЂРё Р°РЅР°Р»РёР·Рµ'

    def _get_user_messages(self, owner_user_id: int, username: str, platform: str, channel_name: str, channel_limit: int, global_limit: int) -> Tuple[List[ChatMessage], List[ChatMessage]]:
        """РџРѕР»СѓС‡Р°РµС‚ СЃРѕРѕР±С‰РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ РєР°РЅР°Р»Сѓ Рё РіР»РѕР±Р°Р»СЊРЅРѕ РїРѕ РІСЃРµРј РєР°РЅР°Р»Р°Рј."""
        try:
            repo = ChatMessageRepository(self.db)
            channel_messages = repo.get_recent_by_author_in_channel(user_id=owner_user_id, author_username=username, channel_name=channel_name, platform=platform, limit=channel_limit)
            global_messages = repo.get_recent_by_author(user_id=owner_user_id, author_username=username, platform=platform, limit=global_limit)
            return (channel_messages, global_messages)
        except Exception:
            logger.exception('Error getting user messages')
            return ([], [])

    def _check_database_health(self) -> bool:
        """РџСЂРѕРІРµСЂСЏРµС‚ Р·РґРѕСЂРѕРІСЊРµ Р±Р°Р·С‹ РґР°РЅРЅС‹С…."""
        try:
            from services.database_cleanup_service import DatabaseCleanupService
            cleanup_service = DatabaseCleanupService(self.db)
            stats = cleanup_service.get_database_stats()
            total_messages = stats.get('total_chat_messages', 0)
            max_total_messages = stats.get('max_total_messages', 100000)
            users_over_limit = stats.get('users_over_message_limit', 0)
            if total_messages > max_total_messages * 0.9:
                logger.warning(f'Database approaching total limit: {total_messages}/{max_total_messages} messages')
                return False
            if users_over_limit > 0:
                logger.warning(f'Users over message limit: {users_over_limit}')
                return False
            return True
        except Exception:
            logger.exception('Error checking database health')
            return True

    def _prepare_messages_for_analysis(self, messages: List[ChatMessage], max_chars: int=2000) -> Tuple[str, int]:
        """РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµС‚ СЃРѕРѕР±С‰РµРЅРёСЏ РґР»СЏ РѕС‚РїСЂР°РІРєРё РІ РЅРµР№СЂРѕСЃРµС‚СЊ."""
        try:
            message_texts = []
            for msg in messages:
                text = (msg.message or '').strip()
                if not text or text.startswith('!'):
                    continue
                text = ' '.join(text.split())
                if len(text) > 200:
                    text = text[:200] + '...'
                message_texts.append(text)
            combined_text = ' | '.join(message_texts)
            if len(combined_text) > max_chars:
                combined_text = combined_text[:max_chars] + '...'
            return (combined_text, len(message_texts))
        except Exception:
            logger.exception('Error preparing messages')
            return ('', 0)

    async def _call_deepseek(self, system_prompt: str, user_prompt: str, max_tokens: int) -> Optional[str]:
        """Send request to DeepSeek chat completions."""
        if not settings.deepseek_api_key:
            return None
        url = f"{settings.deepseek_base_url.rstrip('/')}/chat/completions"
        headers = {'Authorization': f'Bearer {settings.deepseek_api_key}', 'Content-Type': 'application/json'}
        payload = {'model': settings.deepseek_model, 'messages': [{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': user_prompt}], 'temperature': 0.3, 'max_tokens': max_tokens, 'stream': False}
        timeout = aiohttp.ClientTimeout(total=25)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f'DeepSeek API error: {response.status} - {error_text}')
                    return None
                data = await response.json()
        try:
            return (data.get('choices') or [{}])[0].get('message', {}).get('content')
        except Exception:
            return None

    def _normalize_analysis_output(self, text: str) -> str:
        """Normalize analysis output."""
        if not text:
            return ''
        cleaned = ' '.join(text.split())
        return cleaned

    def _has_required_labels(self, text: str) -> bool:
        lower = text.lower()
        required = ['Р°РіСЂРµСЃСЃРёРІРЅРѕСЃС‚СЊ', 'РґРёРјРїР»РёРЅРі', 'С‡СѓРІСЃС‚РІРѕ СЋРјРѕСЂР°', 'РІРЅРёРјР°РЅРёРµР±Р»СЏРґСЃС‚РІРѕ']
        return all((label in lower for label in required))

    async def _request_ai_analysis(self, target_username: str, platform: str, channel_name: str, channel_text: str, channel_count: int, global_text: str, global_count: int) -> Optional[str]:
        """РћС‚РїСЂР°РІР»СЏРµС‚ Р·Р°РїСЂРѕСЃ Рє РР РґР»СЏ Р°РЅР°Р»РёР·Р° Р»РёС‡РЅРѕСЃС‚Рё."""
        try:
            if not settings.deepseek_api_key:
                return '[ERROR] DeepSeek API key РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'
            system_prompt = "РўС‹ Р°РЅР°Р»РёР·РёСЂСѓРµС€СЊ СЃС‚РёР»СЊ РѕР±С‰РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ СЃРѕРѕР±С‰РµРЅРёСЏРј С‡Р°С‚Р°. Р”Р°Р№ РєСЂР°С‚РєРёР№ РїСЃРёС…РѕР»РѕРіРёС‡РµСЃРєРёР№ РїРѕСЂС‚СЂРµС‚ Р±РµР· РјРµРґРёС†РёРЅСЃРєРёС… РґРёР°РіРЅРѕР·РѕРІ Рё Р±РµР· РѕСЃРєРѕСЂР±Р»РµРЅРёР№. РћС‚РІРµС‚ СЃС‚СЂРѕРіРѕ РѕРґРЅРѕР№ СЃС‚СЂРѕРєРѕР№, 100-150 СЃРёРјРІРѕР»РѕРІ. РЎРЅР°С‡Р°Р»Р° РєРѕСЂРѕС‚РєРёР№ РїРѕСЂС‚СЂРµС‚ (20-40 СЃРёРјРІРѕР»РѕРІ), Р·Р°С‚РµРј РѕС†РµРЅРєРё. Р’ РєРѕРЅС†Рµ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РѕС†РµРЅРєРё РїРѕ РєСЂРёС‚РµСЂРёСЏРј: Р°РіСЂРµСЃСЃРёРІРЅРѕСЃС‚СЊ, РґРёРјРїР»РёРЅРі, С‡СѓРІСЃС‚РІРѕ СЋРјРѕСЂР°, РІРЅРёРјР°РЅРёРµР±Р»СЏРґСЃС‚РІРѕ. Р¤РѕСЂРјР°С‚ РѕС†РµРЅРѕРє: 'Р°РіСЂРµСЃСЃРёРІРЅРѕСЃС‚СЊ 3/10, РґРёРјРїР»РёРЅРі 2/10, С‡СѓРІСЃС‚РІРѕ СЋРјРѕСЂР° 7/10, РІРЅРёРјР°РЅРёРµР±Р»СЏРґСЃС‚РІРѕ 4/10'. РќРµ РґРѕР±Р°РІР»СЏР№ РЅРёС‡РµРіРѕ РєСЂРѕРјРµ СЌС‚РѕРіРѕ."
            user_prompt = f"РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ: {target_username}\nРџР»Р°С‚С„РѕСЂРјР°: {platform}\nРљР°РЅР°Р»: {channel_name} (СЃРѕРѕР±С‰РµРЅРёР№: {channel_count})\nCHANNEL_MESSAGES: {channel_text or 'РЅРµС‚'}\nGLOBAL_MESSAGES (РІСЃРµ РєР°РЅР°Р»С‹, СЃРѕРѕР±С‰РµРЅРёР№: {global_count}): {global_text or 'РЅРµС‚'}\nCHANNEL_MESSAGES РІР°Р¶РЅРµРµ, РЅРѕ СѓС‡РёС‚С‹РІР°Р№ РѕР±Р° Р±Р»РѕРєР°."
            max_chars = settings.chat_analysis_output_max_chars
            analysis = await self._call_deepseek(system_prompt, user_prompt, max_tokens=120)
            analysis = self._normalize_analysis_output(analysis or '')
            if analysis and (len(analysis) > max_chars or not self._has_required_labels(analysis)):
                short_prompt = system_prompt + ' РћС‚РІРµС‚ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РµС‰Рµ РєРѕСЂРѕС‡Рµ Рё СЃС‚СЂРѕРіРѕ РїРѕ С„РѕСЂРјР°С‚Сѓ.'
                analysis = await self._call_deepseek(short_prompt, user_prompt, max_tokens=80)
                analysis = self._normalize_analysis_output(analysis or '')
            if analysis and len(analysis) > max_chars:
                analysis = analysis[:max_chars].rstrip()
            return analysis or None
        except Exception:
            logger.exception('Error requesting AI analysis')
            return None

    def _save_analysis_result(self, target_username: str, platform: str, analyzed_by_user_id: int, analyzed_by_username: str, analysis_text: str, messages_count: int):
        """РЎРѕС…СЂР°РЅСЏРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚ Р°РЅР°Р»РёР·Р° РІ Р±Р°Р·Сѓ РґР°РЅРЅС‹С…."""
        try:
            user_repo = UserRepository(self.db)
            if platform == 'vk':
                target_user = user_repo.get_by_vk_username(target_username)
            else:
                target_user = user_repo.get_by_twitch_username(target_username)
            if not target_user:
                logger.error(f'Target user {target_username} not found for platform {platform}')
                return
            repo = PsychologyRepository(self.db)
            repo.add_analysis(target_user_id=target_user.id, target_username=target_username, platform=platform, analyzed_by_user_id=analyzed_by_user_id, analyzed_by_username=analyzed_by_username, analysis_text=analysis_text, messages_count=messages_count)
            logger.info(f'Psychology analysis saved for {target_username}')
        except Exception:
            logger.exception('Error saving analysis result')
            pass

    def get_recent_analysis(self, target_username: str, platform: str, hours: int=24) -> Optional[str]:
        """РџРѕР»СѓС‡Р°РµС‚ РЅРµРґР°РІРЅРёР№ Р°РЅР°Р»РёР· РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РµСЃР»Рё РµСЃС‚СЊ)."""
        try:
            cutoff_time = utcnow_naive() - timedelta(hours=hours)
            repo = PsychologyRepository(self.db)
            analysis = repo.get_recent_analysis(target_username, platform, cutoff_time)
            if analysis:
                return analysis.analysis_text
            return None
        except Exception:
            logger.exception('Error getting recent analysis')
            return None
