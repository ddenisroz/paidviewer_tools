# bot_service/api/points_api_endpoints.py
from fastapi import APIRouter
from api.points.routes import points_core_router
from api.points.twitch_routes import points_twitch_router
from api.points.vk_routes import points_vk_router
from services.platform_rewards_service import PlatformRewardsService
from services.user_service import UserService

# Создаем основной роутер
points_router = APIRouter(prefix="/api/points", tags=["points"])

# Инициализируем сервисы (для совместимости импортов)
user_service = UserService()
platform_service = PlatformRewardsService()

# Подключаем роутеры из модулей
points_router.include_router(points_core_router)
points_router.include_router(points_twitch_router)
points_router.include_router(points_vk_router)

# Re-export models for backward compatibility if needed
# (Though users should import from features.points.points_core_api preferably)
