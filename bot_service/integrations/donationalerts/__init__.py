# bot_service/integrations/donationalerts/__init__.py
"""
DonationAlerts Integration Layer.

TODO: Вынести логику из api/donationalerts_api.py и auth/donationalerts_auth.py
"""

from .client import DonationAlertsClient

__all__ = ["DonationAlertsClient"]
