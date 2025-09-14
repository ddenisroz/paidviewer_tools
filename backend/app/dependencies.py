from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.bot import Bot
from app.services.state_service import StateService
from app.services.tts_service import TTSService
from app.core.security import verify_token

# Dependency provider functions
def get_bot(request: Request) -> Bot:
    """FastAPI dependency to get the bot instance from the application state."""
    return request.app.state.bot

def get_state_service(request: Request) -> StateService:
    """FastAPI dependency to get the state_service instance from the application state."""
    return request.app.state.state_service

def get_tts_service(request: Request) -> TTSService:
    """FastAPI dependency to get the tts_service instance from the application state."""
    return request.app.state.tts_service

# Security
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """FastAPI dependency to get the current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload

