import requests
import urllib3

# Disable SSL warnings for this test
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TOKEN = "65ab9a2bbe0387395faa835f"  # The ID we found
URL = "https://memealerts.com/api/user/me" # Guessing a profile endpoint
# Alternatively try the one we know exists, but with a dummy payload to check auth
URL_GRANT = "https://memealerts.com/api/user/give-bonus"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

print(f"Testing Auth with Token: {TOKEN}")

try:
    # Try 1: Get Profile (safer)
    response = requests.get(URL, headers=headers, verify=False)
    print(f"GET /api/user/me Status: {response.status_code}")
    print(f"Response: {response.text[:200]}")

    if response.status_code == 404:
         # Try 2: Grant endpoint (known existing)
         # We won't send a valid body, just checking if we get 401 or 400/422
         print("Endpoint /me not found, testing /give-bonus auth check...")
         response = requests.post(URL_GRANT, headers=headers, json={}, verify=False)
         print(f"POST /give-bonus Status: {response.status_code}")
         print(f"Response: {response.text[:200]}")

except Exception as e:
    print(f"Error: {e}")
