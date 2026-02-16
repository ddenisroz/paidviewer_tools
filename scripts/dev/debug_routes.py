import sys
import os
from pathlib import Path

# Setup path so we can import from bot_service
BOT_SERVICE_ROOT = Path(__file__).parent / "bot_service"
sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Mock some env vars if needed or just let it fail/warn
os.environ["VI_CLIENT_ID"] = "dummy"
os.environ["VI_CLIENT_SECRET"] = "dummy"

try:
    from bot_service.main import app
    
    print("=== Registered Routes ===")
    found = False
    for route in app.routes:
        if hasattr(route, "path"):
            if "/api/auth/me" in route.path:
                print(f"[FOUND] {route.path} -> {route.name} ({route.methods})")
                found = True
            # else:
            #     print(f"        {route.path}")
    
    if not found:
        print("[ERROR] /api/auth/me NOT FOUND in routes")
        print("\nAll /api/auth routes:")
        for route in app.routes:
             if hasattr(route, "path") and "/api/auth" in route.path:
                 print(f" - {route.path}")

except Exception as e:
    print(f"Error loading app: {e}")
