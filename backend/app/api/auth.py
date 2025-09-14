# backend/app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import httpx
from app.core.config import settings
from app.core.security import create_access_token, encrypt_token, decrypt_token
from typing import Optional
from app.bot import Bot
from urllib.parse import urlencode
from app.services.state_service import StateService
from app.dependencies import get_bot, get_state_service, get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/twitch/login")
async def login_twitch():
    """
    Redirects the user to the Twitch authorization page.
    """
    logger.info("Twitch login requested")
    auth_url = (
        f"https://id.twitch.tv/oauth2/authorize"
        f"?client_id={settings.TWITCH_CLIENT_ID}"
        f"&redirect_uri={settings.TWITCH_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=user:read:email+channel:manage:broadcast"  # Добавляем scope для управления каналом
    )
    logger.info(f"Redirecting to Twitch auth URL: {auth_url}")
    return RedirectResponse(url=auth_url)

@router.get("/twitch/callback")
async def login_twitch_callback(request: Request, code: Optional[str] = None):
    frontend_login_url = "http://localhost:5173/login"
    
    logger.info(f"Twitch callback received with code: {code}")
    
    if not code:
        logger.error("No code received from Twitch")
        return RedirectResponse(url=f"{frontend_login_url}?error=auth_failed_no_code")

    token_params = {
        "client_id": settings.TWITCH_CLIENT_ID,
        "client_secret": settings.TWITCH_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.TWITCH_REDIRECT_URI
    }

    try:
        logger.info("Requesting token from Twitch...")
        async with httpx.AsyncClient() as client:
            token_r = await client.post("https://id.twitch.tv/oauth2/token", data=token_params)
            token_data = token_r.json()
            
            logger.info(f"Token received successfully (access_token present: {'access_token' in token_data})")
            
            if "access_token" not in token_data:
                logger.error(f"Failed to get access token: {token_data}")
                raise HTTPException(status_code=400, detail="Could not validate credentials with Twitch")

            user_access_token = token_data["access_token"]
            
            # Get user info from Twitch using the new access token
            headers = {
                "Authorization": f"Bearer {user_access_token}",
                "Client-Id": settings.TWITCH_CLIENT_ID
            }
            logger.info("Getting user info from Twitch...")
            user_r = await client.get("https://api.twitch.tv/helix/users", headers=headers)
            user_data = user_r.json()["data"][0]
            
            logger.info(f"User info received: {user_data.get('login', 'unknown')} (ID: {user_data.get('id', 'unknown')})")
            user_login = user_data["login"]
            
            # At this point, the user is authenticated with Twitch.
            # Now, we create our own JWT token to manage the session.
            jwt_data = {
                "sub": user_login, 
                "username": user_login,
                "display_name": user_data.get("display_name", user_login),
                "profile_image_url": user_data.get("profile_image_url"),
                "twitch_user_id": user_data["id"]
            }
            jwt_token = create_access_token(data=jwt_data)

            # Сохраняем токен и user_id в состоянии канала
            state_service = request.app.state.state_service
            logger.info(f"Registering channel: {user_login}")
            # Регистрируем канал только если его еще нет
            if user_login not in state_service.channels:
                await state_service.register_channel(user_login)
            else:
                logger.info(f"Channel {user_login} already exists, updating data")
            
            # Обновляем данные канала с токеном и user_id
            channel_data = state_service.get_channel_data(user_login)
            # Шифруем токен перед сохранением
            encrypted_token = encrypt_token(user_access_token)
            if "integrations" not in channel_data:
                channel_data["integrations"] = {}
            channel_data["integrations"]["twitch_token"] = encrypted_token
            channel_data["integrations"]["twitch_user_id"] = user_data["id"]
            channel_data["integrations"]["twitch_enabled"] = True
            
            logger.info(f"Saving channel data for {user_login} (token present: {'twitch_token' in channel_data.get('integrations', {})})")
            state_service.set_channel_data(user_login, channel_data)
            
            logger.info(f"Successfully saved Twitch token and user_id for channel: {user_login}")
            logger.info(f"Channel integrations enabled: {list(channel_data.get('integrations', {}).keys())}")

            # Tell the bot to join the user's channel
            if bot := request.app.state.bot:
                await bot.add_channel(user_login)

            # Redirect to the frontend with the JWT token and close popup
            response = RedirectResponse(url=f"http://localhost:5173/auth/callback?token={jwt_token}&close_popup=true")
            return response

    except httpx.HTTPStatusError as e:
        logger.error(f"Error communicating with Twitch: {e}")
        logger.error(f"Response: {e.response.text if hasattr(e, 'response') else 'No response'}")
        return RedirectResponse(url=f"{frontend_login_url}?error=twitch_token_exchange_failed")
    except Exception as e:
        logger.error(f"An unexpected error occurred during Twitch callback: {e}")
        logger.error(f"Exception type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return RedirectResponse(url=f"{frontend_login_url}?error=internal_server_error")


@router.get("/vk/login")
async def login_via_vk():
    """
    Redirects the user to the VK authorization page.
    """
    auth_url = "https://oauth.vk.com/authorize"
    params = {
        "client_id": settings.VK_CLIENT_ID,
        "redirect_uri": settings.VK_REDIRECT_URI,
        "display": "page",
        "scope": "video,offline", # Добавляем video для VK Live
        "response_type": "code",
        "v": "5.131", # API version
        "state": "vk_live_auth" # Добавляем state для безопасности
    }
    return RedirectResponse(f"{auth_url}?{urlencode(params)}")


@router.get("/vk/callback")
async def vk_callback(code: str, state_service: StateService = Depends(get_state_service), bot: Bot = Depends(get_bot)):
    """
    Handles the callback from VK after user authorization.
    """
    token_url = "https://oauth.vk.com/access_token"
    token_params = {
        "client_id": settings.VK_CLIENT_ID,
        "client_secret": settings.VK_CLIENT_SECRET,
        "redirect_uri": settings.VK_REDIRECT_URI,
        "code": code,
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # 1. Exchange authorization code for access token
            token_response = await client.get(token_url, params=token_params)
            token_response.raise_for_status()
            token_data = token_response.json()

            access_token = token_data.get("access_token")
            email = token_data.get("email")
            user_id = token_data.get("user_id")

            if not access_token or not user_id:
                raise HTTPException(status_code=400, detail="Failed to retrieve access token or user ID from VK")

            # 2. Get user info from VK API
            user_info_url = "https://api.vk.com/method/users.get"
            user_params = {
                "user_ids": user_id,
                "fields": "id,first_name,last_name,photo_200_orig",
                "access_token": access_token,
                "v": "5.131"
            }
            user_info_response = await client.get(user_info_url, params=user_params)
            user_info_response.raise_for_status()
            user_info_data = user_info_response.json()["response"][0]
            
            # Use first_name and last_name as username and display_name for simplicity
            username = f"{user_info_data['first_name']}_{user_info_data['last_name']}".lower()
            display_name = f"{user_info_data['first_name']} {user_info_data['last_name']}"

            # 3. User exists check / creation (simplified)
            # In a real app, you'd check your DB. Here we just add them to the state.
            await state_service.register_channel(username)
            # await bot.join_channels([username]) # VK doesn't have "channels" like Twitch, adapt as needed

            # 4. Create JWT token
            jwt_payload = {
                "sub": str(user_info_data["id"]),
                "username": username,
                "display_name": display_name,
                "profile_image_url": user_info_data.get("photo_200_orig"),
                "provider": "vk"
            }
            jwt_token = create_access_token(data=jwt_payload)
            
            # 5. Redirect to frontend with the token
            response = RedirectResponse(url=f"{settings.CLIENT_ORIGIN}/auth/callback")
            response.set_cookie(
                key="token",
                value=jwt_token,
                httponly=True,
                max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                samesite="lax",
            )
            return response
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error during VK auth: {e.response.text}")
            raise HTTPException(status_code=400, detail=f"Error communicating with VK: {e.response.text}")
        except Exception as e:
            logger.error(f"An unexpected error occurred during VK auth: {e}")
            raise HTTPException(status_code=500, detail="An internal error occurred during VK authentication.")


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
        bot: Bot = request.app.state.bot
        await bot.remove_channel(channel_name)
        return {"message": f"Bot has left channel {channel_name}"}
    except Exception as e:
        print(f"Error during logout: {e}")
        # Don't block logout if bot fails to part, just log it.
        # The main goal is to let the frontend proceed with clearing the token.
        return {"message": f"Logout processed, but bot might have failed to leave channel {channel_name}"}


@router.get("/user/me")
async def read_users_me(user: dict = Depends(get_current_user)):
    # Return the user details from the JWT payload
    return {
        "id": user.get("sub"),
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "profile_image_url": user.get("profile_image_url")
    }


