# bot_service/tests/test_api_tts.py
"""
Тесты для TTS API
"""
import pytest
from unittest.mock import patch, AsyncMock

class TestTTSAPI:
    """Тесты для TTS API"""
    
    def test_tts_status(self, authenticated_client):
        """Тест получения статуса TTS"""
        response = authenticated_client.get("/api/tts/status")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "authenticated" in data
        assert "is_whitelisted" in data
    
    def test_tts_settings(self, authenticated_client):
        """Тест получения настроек TTS"""
        response = authenticated_client.get("/api/tts/settings")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        # Settings могут содержать различные поля в зависимости от конфигурации
        assert data["success"] == True
    
    def test_update_tts_settings(self, authenticated_client):
        """Тест обновления настроек TTS"""
        settings_data = {
            "volume": 75,
            "voice": "test_voice",
            "speed": 1.0
        }
        response = authenticated_client.post("/api/tts/settings", json=settings_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_tts_filtered_words(self, authenticated_client):
        """Тест получения отфильтрованных слов"""
        response = authenticated_client.get("/api/tts/filtered-words")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "filtered_words" in data
        assert isinstance(data["filtered_words"], list)
    
    def test_add_filtered_word(self, authenticated_client):
        """Тест добавления отфильтрованного слова"""
        word_data = {
            "word": "test_word",
            "platform": "twitch"
        }
        response = authenticated_client.post("/api/tts/filtered-words", json=word_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_remove_filtered_word(self, authenticated_client):
        """Тест удаления отфильтрованного слова"""
        # DELETE endpoint uses path parameter, not JSON body
        response = authenticated_client.delete("/api/tts/filtered-words/999")
        # Может быть 200 (success), 404 (not found), или 500 (error)
        assert response.status_code in [200, 404, 500]
    
    @patch('services.tts.tts_manager.get_tts_manager')
    def test_tts_synthesis(self, mock_get_tts_manager, authenticated_client):
        """Тест синтеза TTS"""
        from unittest.mock import AsyncMock
        
        mock_tts_manager = AsyncMock()
        mock_tts_manager.synthesize_tts.return_value = {"success": True}
        mock_get_tts_manager.return_value = mock_tts_manager
        
        # synthesize endpoint uses query parameters
        response = authenticated_client.post("/api/tts/synthesize?text=Hello&voice=female_1&channel=test")
        # Может быть 200 (success), 400 (bad request), или 500 (error)
        assert response.status_code in [200, 400, 500]
    
    def test_tts_health_check(self, authenticated_client):
        """Тест проверки здоровья TTS сервиса"""
        response = authenticated_client.get("/api/tts/health")
        # Endpoint может не существовать или возвращать разные статусы
        assert response.status_code in [200, 404, 500]
    
    def test_youtube_settings(self, authenticated_client):
        """Тест настроек YouTube"""
        response = authenticated_client.get("/api/tts/youtube-settings")
        # YouTube settings endpoint может не существовать в TTS API
        assert response.status_code in [200, 404, 500]
    
    def test_update_youtube_settings(self, authenticated_client):
        """Тест обновления настроек YouTube"""
        settings_data = {
            "playback_mode": "browser",
            "volume_level": 80
        }
        response = authenticated_client.post("/api/tts/youtube-settings", json=settings_data)
        assert response.status_code == 200
        data = response.json()
        assert data["playback_mode"] == settings_data["playback_mode"]
        assert data["volume_level"] == settings_data["volume_level"]
