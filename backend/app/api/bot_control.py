# backend/app/api/bot_control.py
from fastapi import APIRouter, Request, HTTPException
from app.dependencies import get_state_service
from app.services.state_service import StateService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/start")
async def start_bot(request: Request):
    """Запустить бота"""
    try:
        bot = request.app.state.bot
        if bot and not bot.is_running:
            await bot.start()
            logger.info("Bot started successfully")
            return {"success": True, "message": "Бот запущен"}
        elif bot and bot.is_running:
            return {"success": True, "message": "Бот уже запущен"}
        else:
            return {"success": False, "message": "Бот не инициализирован"}
    except Exception as e:
        logger.error(f"Error starting bot: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка запуска бота: {str(e)}")

@router.post("/stop")
async def stop_bot(request: Request):
    """Остановить бота"""
    try:
        bot = request.app.state.bot
        if bot and bot.is_running:
            await bot.stop()
            logger.info("Bot stopped successfully")
            return {"success": True, "message": "Бот остановлен"}
        elif bot and not bot.is_running:
            return {"success": True, "message": "Бот уже остановлен"}
        else:
            return {"success": False, "message": "Бот не инициализирован"}
    except Exception as e:
        logger.error(f"Error stopping bot: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка остановки бота: {str(e)}")

@router.get("/status")
async def get_bot_status(request: Request):
    """Получить статус бота"""
    try:
        bot = request.app.state.bot
        if bot:
            return {
                "success": True, 
                "running": bot.is_running,
                "message": "Бот запущен" if bot.is_running else "Бот остановлен"
            }
        else:
            return {"success": False, "message": "Бот не инициализирован"}
    except Exception as e:
        logger.error(f"Error getting bot status: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения статуса бота: {str(e)}")

