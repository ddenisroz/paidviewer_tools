"""
API endpoints for platform configuration
"""
from fastapi import APIRouter
from platforms.registry import platform_registry
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/platforms/config")
async def get_platforms_config():
    """
    Get configuration for all available platforms
    
    Returns:
        List of platform configurations with capabilities
    """
    try:
        configs = platform_registry.get_configs()
        logger.debug(f"Returning {len(configs)} platform configurations")
        return {"platforms": configs}
    except Exception as e:
        logger.error(f"Error getting platform configs: {e}")
        return {"platforms": []}


@router.get("/api/platforms/list")
async def list_platforms():
    """
    Get list of available platform names
    
    Returns:
        List of platform names
    """
    try:
        platforms = platform_registry.get_all()
        platform_names = list(platforms.keys())
        logger.debug(f"Available platforms: {platform_names}")
        return {"platforms": platform_names}
    except Exception as e:
        logger.error(f"Error listing platforms: {e}")
        return {"platforms": []}
