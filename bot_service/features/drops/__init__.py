# features/drops/__init__.py
"""
Drops feature module

This module contains all drops-related functionality including:
- DropsService: Main service for drops logic
- DropsCalculationService: Probability-based drop calculation
- drops_api: API endpoints for drops management
"""

from .drops_service import DropsService, DropsCalculationService
from .drops_api import router as drops_router

__all__ = [
    'DropsService',
    'DropsCalculationService',
    'drops_router',
]
