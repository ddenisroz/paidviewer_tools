from fastapi import Request
from app.bot import Bot
from app.services.state_service import StateService

# Dependency provider functions
def get_bot(request: Request) -> Bot:
    """FastAPI dependency to get the bot instance from the application state."""
    return request.app.state.bot

def get_state_service(request: Request) -> StateService:
    """FastAPI dependency to get the state_service instance from the application state."""
    return request.app.state.state_service

