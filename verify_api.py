import requests
import sys

try:
    print("Checking http://127.0.0.1:8000/api/auth/me ...")
    r_me = requests.get("http://127.0.0.1:8000/api/auth/me")
    print(f"Status Code: {r_me.status_code}")
    print(f"Response: {r_me.text[:100]}")
    
    print("\nChecking http://127.0.0.1:8000/api/auth/check-username ...")
    r_check = requests.get("http://127.0.0.1:8000/api/auth/check-username?username=test")
    print(f"Status Code: {r_check.status_code}")
except Exception as e:
    print(f"Error: {e}")
