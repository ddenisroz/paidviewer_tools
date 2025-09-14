# backend/app/core/security.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.core.config import settings
from starlette import status
from cryptography.fernet import Fernet
import base64
import hashlib

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify and decode a JWT token, returning the payload if valid, None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        # 'sub' is the standard claim for the subject (user identifier).
        # We will use this as the username.
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
        
        # For consistency, let's also grab the twitch_user_id if it exists
        user_id: str | None = payload.get("twitch_user_id")

    except JWTError:
        raise credentials_exception
    
    return {"username": username, "user_id": user_id}

def _get_encryption_key():
    """Generate a consistent encryption key from the secret key"""
    # Use the secret key to generate a consistent encryption key
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_token(token: str) -> str:
    """Encrypt a token for secure storage"""
    try:
        f = Fernet(_get_encryption_key())
        encrypted_token = f.encrypt(token.encode())
        return encrypted_token.decode()
    except Exception as e:
        # If encryption fails, return the original token (fallback)
        return token

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token from secure storage"""
    try:
        f = Fernet(_get_encryption_key())
        decrypted_token = f.decrypt(encrypted_token.encode())
        return decrypted_token.decode()
    except Exception as e:
        # If decryption fails, return the original token (fallback)
        return encrypted_token
