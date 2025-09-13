# backend/app/api/auth.py
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
import httpx
from app.core.config import settings
from app.core.security import create_access_token, get_current_user
from typing import Optional
from app.bot import Bot as TwitchBot # Use the correct Bot class

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/twitch/login")
async def login_twitch():
    """
    Redirects the user to the Twitch authorization page.
    """
    auth_url = (
        f"https://id.twitch.tv/oauth2/authorize"
        f"?client_id={settings.TWITCH_CLIENT_ID}"
        f"&redirect_uri={settings.TWITCH_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=user:read:email"  # Add any other scopes you need
    )
    return RedirectResponse(url=auth_url)

@router.get("/twitch/callback")
async def login_twitch_callback(request: Request, code: Optional[str] = None):
    frontend_login_url = "http://localhost:5173/login"
    
    if not code:
        return RedirectResponse(url=f"{frontend_login_url}?error=auth_failed_no_code")

    token_params = {
        "client_id": settings.TWITCH_CLIENT_ID,
        "client_secret": settings.TWITCH_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.TWITCH_REDIRECT_URI
    }

    try:
        async with httpx.AsyncClient() as client:
            token_r = await client.post("https://id.twitch.tv/oauth2/token", data=token_params)
            token_data = token_r.json()
            
            if "access_token" not in token_data:
                raise HTTPException(status_code=400, detail="Could not validate credentials with Twitch")

            user_access_token = token_data["access_token"]
            
            # Get user info from Twitch using the new access token
            headers = {
                "Authorization": f"Bearer {user_access_token}",
                "Client-Id": settings.TWITCH_CLIENT_ID
            }
            user_r = await client.get("https://api.twitch.tv/helix/users", headers=headers)
            user_data = user_r.json()["data"][0]
            
            user_login = user_data["login"]
            
            # At this point, the user is authenticated with Twitch.
            # Now, we create our own JWT token to manage the session.
            jwt_data = {"sub": user_login, "twitch_user_id": user_data["id"]}
            jwt_token = create_access_token(data=jwt_data)

            # Tell the bot to join the user's channel
            if bot := request.app.state.bot:
                await bot.add_channel(user_login)

            # Redirect to the frontend with the JWT token
            response = RedirectResponse(url=f"http://localhost:5173/auth/callback?token={jwt_token}")
            return response

    except httpx.HTTPStatusError as e:
        print(f"Error communicating with Twitch: {e}")
        return RedirectResponse(url=f"{frontend_login_url}?error=twitch_token_exchange_failed")
    except Exception as e:
        print(f"An unexpected error occurred during Twitch callback: {e}")
        return RedirectResponse(url=f"{frontend_login_url}?error=internal_server_error")


@router.post("/logout")
async def logout(request: Request, user: dict = Depends(get_current_user)):
    """
    Logs the user out by telling the bot to part the channel.
    The frontend is responsible for clearing the token.
    """
    if not user or "username" not in user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    channel_name = user["username"]
    
    try:
        bot: TwitchBot = request.app.state.bot
        await bot.remove_channel(channel_name)
        return {"message": f"Bot has left channel {channel_name}"}
    except Exception as e:
        print(f"Error during logout: {e}")
        # Don't block logout if bot fails to part, just log it.
        # The main goal is to let the frontend proceed with clearing the token.
        return {"message": f"Logout processed, but bot might have failed to leave channel {channel_name}"}


