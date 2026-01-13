"""
Константы для bot_service
Централизованное хранение всех магических чисел, строк и конфигурационных значений

NOTE: URL и другие конфигурационные значения берутся из core.config.settings
Этот файл содержит только статические константы (enum-like классы, magic numbers)
"""
from core.config import settings

# === URL КОНСТАНТЫ (из централизованной конфигурации) ===
DEFAULT_FRONTEND_URL = settings.frontend_url
DEFAULT_BACKEND_URL = settings.backend_url
DEFAULT_TTS_SERVICE_URL = settings.tts_service_url

# OAuth редиректы
OAUTH_REDIRECT_URLS = {
    "twitch": f"{DEFAULT_BACKEND_URL}/auth/twitch/callback",
    "vk": f"{DEFAULT_BACKEND_URL}/auth/vk/callback"
}

# Frontend редиректы
FRONTEND_REDIRECTS = {
    "dashboard": f"{DEFAULT_FRONTEND_URL}/dashboard",
    "settings": f"{DEFAULT_FRONTEND_URL}/dashboard/settings",
    "login": f"{DEFAULT_FRONTEND_URL}/login"
}

# === ВРЕМЕННЫЕ КОНСТАНТЫ (в секундах) ===
# Бесконечная сессия - сессия живет до явного логаута или логина с другого устройства
SESSION_MAX_AGE_SECONDS = 315360000  # 10 лет (315360000 секунд) - практически бесконечно
VERIFICATION_TIMEOUT_SECONDS = 60  # Таймаут верификации для гостей
MESSAGE_CHECK_INTERVAL = 5  # Интервал проверки сообщений VK (сек)
BOT_CONNECTION_WAIT = 2  # Время ожидания подключения бота (сек)
STREAM_ONLINE_THRESHOLD_MINUTES = 5  # Порог для определения онлайн стрима (мин)

# === TTS DISCONNECT TIMEOUT ===
# Таймаут ожидания переподключения перед отключением TTS (в секундах)
# Увеличен для OBS и сайта (могут быть задержки при перезагрузке)
TTS_RECONNECT_TIMEOUT_SECONDS = 60  # По умолчанию 60 секунд

# === AUTH TYPE ===
# Оставляем только полную OAuth авторизацию
class AuthType:
    FULL = "full"

# === HTTP STATUS CODES ===
class HTTP_STATUS:
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_SERVER_ERROR = 500

# === TTS КОНСТАНТЫ ===
TTS_DEFAULT_CFG_STRENGTH = 2.5
TTS_DEFAULT_VOLUME = 50.0  # Дефолтная громкость TTS (0-100)
TTS_DEFAULT_SPEED_PRESET = 'normal'  # Дефолтная скорость речи
TTS_CROSS_FADE_DURATION = 0.15
TTS_SILENCE_DURATION_MS = 100
TTS_SWAY_SAMPLING_COEF = -1.0
TTS_MESSAGE_MAX_LENGTH = 500  # Максимальная длина сообщения для TTS
TTS_MAX_RETRIES = 2  # Количество попыток для AI TTS
TTS_RETRY_DELAY = 0.5  # Задержка между попытками (секунды)
TTS_HEALTH_CHECK_INTERVAL = 30  # Интервал проверки здоровья TTS сервиса (секунды)

# === YOUTUBE КОНСТАНТЫ ===
MAX_YOUTUBE_QUEUE_SIZE = 10  # Максимальное количество видео в очереди на пользователя

# === ПЛАТФОРМЫ ===
SUPPORTED_PLATFORMS = ["twitch", "vk"]

# Default platforms enabled for new users
DEFAULT_ENABLED_PLATFORMS = ["twitch", "vk"]

# All supported platforms (including future)
ALL_SUPPORTED_PLATFORMS = ["twitch", "vk", "youtube"]

# Platform display names
PLATFORM_NAMES = {
    "twitch": "Twitch",
    "vk": "VK Live",
    "youtube": "YouTube"
}

class Platform:
    TWITCH = "twitch"
    VK = "vk"
    YOUTUBE = "youtube"  # Для будущего использования

# === РОЛИ ПОЛЬЗОВАТЕЛЕЙ ===
class UserRole:
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"

# === SCOPES для OAuth ===
# Используем только полную OAuth авторизацию
OAUTH_SCOPES = {
    "twitch": "user:read:email channel:read:stream_key channel:manage:broadcast channel:manage:redemptions",
    "vk": "channel:stream:settings,channel:points:rewards,channel:points:rewards:demands"
}

# === ЛОГИРОВАНИЕ ===
DEFAULT_LOG_LEVEL = "DEBUG"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# === DATABASE ===
DEFAULT_BLOCKED_BOTS = [
    "StreamElements", "Nightbot", "Streamlabs", "Moobot", "TwirApp"
]

# === API RESPONSES ===
class ApiResponse:
    SUCCESS = "success"
    ERROR = "error"
    AUTHENTICATION_REQUIRED = "authentication_required"
    INVALID_REQUEST = "invalid_request"
    RATE_LIMITED = "rate_limited"

# === ERROR MESSAGES ===
class ErrorMessages:
    # Auth errors
    OAUTH_FAILED = "OAuth authorization failed"
    NO_AUTH_CODE = "No authorization code received"
    INVALID_CREDENTIALS = "Invalid credentials"
    TOKEN_EXPIRED = "Token has expired"

    # User errors
    USER_NOT_FOUND = "User not found"
    USER_CREATION_FAILED = "Could not create user account"

    # Bot errors
    BOT_NOT_RUNNING = "Bot not running"
    BOT_CONNECTION_FAILED = "Failed to connect bot to channel"
    BOT_DISCONNECTION_FAILED = "Failed to disconnect bot from channel"

    # Channel errors
    CHANNEL_BLOCKED = "Channel is blocked"
    CHANNEL_NOT_WHITELISTED = "Channel not whitelisted for TTS"

    # TTS errors
    TTS_NOT_ENABLED = "TTS not enabled for this channel"
    TTS_MESSAGE_TOO_LONG = f"Message too long (max {TTS_MESSAGE_MAX_LENGTH} characters)"

    # Generic errors
    INTERNAL_ERROR = "Internal server error"
    INVALID_REQUEST = "Invalid request"
    MISSING_PARAMETER = "Missing required parameter"

# === SUCCESS MESSAGES ===
class SuccessMessages:
    USER_CREATED = "User account created successfully"
    INTEGRATION_ENABLED = "Integration enabled successfully"
    INTEGRATION_DISABLED = "Integration disabled successfully"
    BOT_CONNECTED = "Bot connected successfully"
    BOT_DISCONNECTED = "Bot disconnected successfully"
    TTS_ENABLED = "TTS enabled"
    TTS_DISABLED = "TTS disabled"

# === ENVIRONMENT VARIABLES ===
class EnvVars:
    # Database
    DATABASE_URL = "DATABASE_URL"

    # JWT
    SECRET_KEY = "SECRET_KEY"
    ALGORITHM = "ALGORITHM"

    # Twitch
    TWITCH_CLIENT_ID = "TWITCH_CLIENT_ID"
    TWITCH_CLIENT_SECRET = "TWITCH_CLIENT_SECRET"
    TWITCH_BOT_TOKEN = "TWITCH_BOT_TOKEN"

    # VK
    VK_CLIENT_ID = "VK_CLIENT_ID"
    VK_CLIENT_SECRET = "VK_CLIENT_SECRET"
    VK_REDIRECT_URI = "VK_REDIRECT_URI"
    VK_AUTH_BASE_URL = "VK_AUTH_BASE_URL"
    VK_LIVE_USER_TOKEN = "VK_LIVE_USER_TOKEN"

    # Services
    TTS_SERVICE_URL = "TTS_SERVICE_URL"

    # Admin
    ADMIN_USERS = "ADMIN_USERS"

    # Logging
    LOG_LEVEL = "LOG_LEVEL"

# === WEBSOCKET EVENTS ===
class WSEvents:
    USER_CONNECTED = "user_connected"
    USER_DISCONNECTED = "user_disconnected"
    MESSAGE_RECEIVED = "message_received"
    TTS_REQUEST = "tts_request"
    INTEGRATION_UPDATE = "integration_update"
    BOT_STATUS_CHANGE = "bot_status_change"

# === CACHE KEYS ===
class CacheKeys:
    TWITCH_CATEGORIES = "twitch:categories"
    TWITCH_STREAMS = "twitch:streams"
    YOUTUBE_VIDEOS = "youtube:videos"
    USER_SESSIONS = "user:sessions"
    BOT_STATUS = "bot:status"

# === VALIDATION RULES ===
class ValidationRules:
    USERNAME_MIN_LENGTH = 3
    USERNAME_MAX_LENGTH = 25
    PASSWORD_MIN_LENGTH = 8
    CHANNEL_NAME_MIN_LENGTH = 3
    CHANNEL_NAME_MAX_LENGTH = 25

    # Регулярные выражения
    USERNAME_PATTERN = r"^[a-zA-Z0-9_]{3,25}$"
    CHANNEL_NAME_PATTERN = r"^[a-zA-Z0-9_]{3,25}$"

# === RATE LIMITING ===
class RateLimit:
    REQUESTS_PER_MINUTE = 60
    REQUESTS_PER_HOUR = 1000
    AUTH_ATTEMPTS_PER_HOUR = 5
    TTS_REQUESTS_PER_MINUTE = 10
