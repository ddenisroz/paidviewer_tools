#!/usr/bin/env python3
"""
Script to check Twitch bot token configuration.

Usage:
    python scripts/check_twitch_token.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings


def check_token():
    """Check Twitch bot token configuration."""
    print("=" * 80)
    print("TWITCH BOT TOKEN CHECK")
    print("=" * 80)
    
    # Check if token is configured
    if not settings.twitch_bot_token:
        print("[ERROR] TWITCH_BOT_TOKEN is NOT configured in .env file")
        print("\nTo fix:")
        print("1. Go to: https://twitchapps.com/tmi/")
        print("2. Click 'Connect' and authorize")
        print("3. Copy the OAuth token")
        print("4. Add to bot_service/.env:")
        print("   TWITCH_BOT_TOKEN=oauth:your-token-here")
        return False
    
    print(" TWITCH_BOT_TOKEN is configured")
    
    # Check token format
    token = settings.twitch_bot_token
    
    # Check prefix
    if not token.startswith("oauth:"):
        print("[ERROR] Token does NOT start with 'oauth:' prefix")
        print(f"   Current prefix: {token[:10]}...")
        print("\nTo fix:")
        print("   Make sure your token starts with 'oauth:' (lowercase)")
        print("   Example: TWITCH_BOT_TOKEN=oauth:abc123def456...")
        return False
    
    print(" Token has correct 'oauth:' prefix")
    
    # Check token length
    token_length = len(token)
    if token_length < 30:
        print(f"вљ пёЏ  Token seems too short: {token_length} characters")
        print("   Expected: ~36 characters")
        print("   Your token might be incomplete")
        return False
    
    print(f" Token length looks good: {token_length} characters")
    
    # Mask token for display
    masked_token = token[:10] + "..." + token[-4:]
    print(f"\nToken preview: {masked_token}")
    
    print("\n" + "=" * 80)
    print("TOKEN CONFIGURATION IS CORRECT")
    print("=" * 80)
    print("\nIf the bot still fails to connect:")
    print("1. The token might be expired/revoked")
    print("2. Generate a new token at: https://twitchapps.com/tmi/")
    print("3. Update bot_service/.env with the new token")
    print("4. Restart the bot service")
    
    return True


if __name__ == "__main__":
    try:
        success = check_token()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] Error checking token: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
