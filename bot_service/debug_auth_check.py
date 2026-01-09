import requests
import sys
import os

# Ensure we can import from core
sys.path.append(os.getcwd())

from core.session_manager import session_manager

def debug_auth():
    print("Creating debug session for User ID 1...")
    try:
        session_id = session_manager.create_session(user_id=1, device_info={"platform": "debug_script"})
        print(f"Session Created: {session_id}")
    except Exception as e:
        print(f"Failed to create session: {e}")
        return

    url = "http://localhost:8000/api/auth/status"
    cookies = {"session_id": session_id}
    
    print(f"Requesting {url} with cookie...")
    try:
        resp = requests.get(url, cookies=cookies)
        print(f"Status Code: {resp.status_code}")
        print(f"Response Body: {resp.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    debug_auth()
